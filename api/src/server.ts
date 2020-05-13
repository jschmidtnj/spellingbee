import 'reflect-metadata';
import { ApolloServer } from 'apollo-server-express';
import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import depthLimit from 'graphql-depth-limit';
import HttpStatus from 'http-status-codes';
import { getLogger } from 'log4js';
import cookieParser from 'cookie-parser';
import { getContext, GraphQLContext, onSubscription, SubscriptionContextParams, SubscriptionContext } from './utils/context';
import { createServer } from 'http';
import { buildSchema } from 'type-graphql';
import { ObjectId } from 'mongodb';
import { ObjectIdScalar } from './scalars/ObjectId';
import { join } from 'path';
import { graphqlUploadExpress } from 'graphql-upload';
import { TypegooseMiddleware } from './db/typegoose';
import { handleRefreshToken } from './utils/jwt';

const maxDepth = 7;
const logger = getLogger();

export const initializeServer = async (): Promise<void> => {
  if (!process.env.PORT) {
    const message = 'cannot find port';
    throw new Error(message);
  }
  const port = Number(process.env.PORT);
  if (!port) {
    const message = 'port is not numeric';
    throw new Error(message);
  }
  if (!process.env.WEBSITE_URL) {
    const message = 'no website url provided';
    throw new Error(message);
  }
  const app = express();
  app.use(cors({
    origin: process.env.WEBSITE_URL,
    credentials: true
  }));
  app.use(cookieParser());
  const schema = await buildSchema({
    resolvers: [join(__dirname, '/**/**/*.resolver.{ts,js}')],
    scalarsMap: [{
      type: ObjectId,
      scalar: ObjectIdScalar
    }],
    globalMiddlewares: [TypegooseMiddleware],
    emitSchemaFile: {
      path: join(__dirname, '../schema.graphql'),
      commentDescriptions: true
    },
  });
  // https://github.com/MichalLytek/type-graphql/issues/37#issuecomment-592467594
  app.use(graphqlUploadExpress({
    maxFileSize: 10000000,
    maxFiles: 10
  }));
  const server = new ApolloServer({
    schema,
    validationRules: [depthLimit(maxDepth)],
    subscriptions: {
      onConnect: (connectionParams: SubscriptionContextParams): Promise<SubscriptionContext> => onSubscription(connectionParams),
    },
    context: async (req): Promise<GraphQLContext> => getContext(req),
    uploads: false,
    introspection: true
  });
  app.use(server.graphqlPath, compression());
  server.applyMiddleware({
    app,
    path: server.graphqlPath,
    cors: false
  });
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(bodyParser.json());
  app.get('/hello', (_, res) => {
    res.json({
      message: 'hello world!'
    }).status(HttpStatus.OK);
  });
  app.post('/refreshToken', async (req, res) => {
    try {
      const accessToken = await handleRefreshToken(req);
      res.json({
        accessToken,
        message: 'got access token'
      }).status(HttpStatus.OK);
    } catch (err) {
      const errObj = err as Error;
      res.json({
        message: errObj.message
      }).status(HttpStatus.BAD_REQUEST);
    }
  });
  const httpServer = createServer(app);
  server.installSubscriptionHandlers(httpServer);
  httpServer.listen(port, () => logger.info(`Api started: http://localhost:${port}/graphql 🚀`));
};
