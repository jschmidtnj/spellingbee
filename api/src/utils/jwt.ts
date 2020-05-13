import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { Request } from 'express';
import { nanoid } from 'nanoid';
import User, { Plan, UserType, UserModel } from '../schema/user';

export const enum jwtType { LOCAL }

export interface AuthData {
  id: string;
  plan: string;
  type: string;
  emailVerified: boolean;
}

export interface RefreshTokenData {
  id: string;
  tokenVersion: number;
}

const accessJWTExpiration = '2h';
const refreshJWTExpiration = '2h';

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('no jwt secret found');
  }
  return secret;
};

const getJWTIssuer = (): string => {
  const jwtIssuer = process.env.JWT_ISSUER;
  if (!jwtIssuer) {
    throw new Error('no jwt issuer found');
  }
  return jwtIssuer;
};

export const generateJWTGuest = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    let secret: string;
    let jwtIssuer: string;
    try {
      secret = getSecret();
      jwtIssuer = getJWTIssuer();
    } catch (err) {
      reject(err as Error);
      return;
    }
    const authData: AuthData = {
      id: nanoid(),
      plan: Plan.free,
      type: UserType.visitor,
      emailVerified: false,
    };
    const signOptions: SignOptions = {
      issuer: jwtIssuer,
      expiresIn: accessJWTExpiration
    };
    jwt.sign(authData, secret, signOptions, (err, token) => {
      if (err) {
        reject(err as Error);
      } else {
        resolve(token as string);
      }
    });
  });
};

export const generateJWTAccess = (user: User): Promise<string> => {
  return new Promise((resolve, reject) => {
    let secret: string;
    let jwtIssuer: string;
    try {
      secret = getSecret();
      jwtIssuer = getJWTIssuer();
    } catch (err) {
      reject(err as Error);
      return;
    }
    if (!user._id) {
      reject('id required');
      return;
    }
    const authData: AuthData = {
      id: user._id.toHexString(),
      plan: user.plan,
      type: user.type,
      emailVerified: user.emailVerified,
    };
    const signOptions: SignOptions = {
      issuer: jwtIssuer,
      expiresIn: accessJWTExpiration
    };
    jwt.sign(authData, secret, signOptions, (err, token) => {
      if (err) {
        reject(err as Error);
      } else {
        resolve(token as string);
      }
    });
  });
};

export const generateJWTRefresh = (user: User): Promise<string> => {
  return new Promise((resolve, reject) => {
    let secret: string;
    let jwtIssuer: string;
    try {
      secret = getSecret();
      jwtIssuer = getJWTIssuer();
    } catch (err) {
      reject(err as Error);
      return;
    }
    if (!user._id) {
      reject('id required');
      return;
    }
    const authData: RefreshTokenData = {
      id: user._id.toHexString(),
      tokenVersion: user.tokenVersion
    };
    const signOptions: SignOptions = {
      issuer: jwtIssuer,
      expiresIn: refreshJWTExpiration
    };
    jwt.sign(authData, secret, signOptions, (err, token) => {
      if (err) {
        reject(err as Error);
      } else {
        resolve(token as string);
      }
    });
  });
};

export const handleRefreshToken = (req: Request): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!req.cookies) {
      throw new Error('no cookies found');
    }
    const token = req.cookies.refreshToken as string | undefined;
    if (!token || token.length === 0) {
      throw new Error('no token provided');
    }
    let secret: string;
    try {
      secret = getSecret();
    } catch (err) {
      reject(err as Error);
      return;
    }
    const jwtConfig: VerifyOptions = {
      algorithms: ['HS256']
    };
    jwt.verify(token, secret, jwtConfig, async (err, res: any) => {
      if (err) {
        reject(err as Error);
      } else {
        const user = await UserModel.findById(res.id);
        if (!user) {
          reject(new Error('user not found'));
          return;
        }
        if (user.tokenVersion !== res.tokenVersion) {
          reject(new Error('user not found'));
          return;
        }
        resolve(await generateJWTAccess(user));
      }
    });
  });
};

export const decodeAuth = (token: string): Promise<AuthData> => {
  return new Promise((resolve, reject) => {
    let secret: string;
    try {
      secret = getSecret();
    } catch (err) {
      reject(err as Error);
      return;
    }
    const jwtConfig: VerifyOptions = {
      algorithms: ['HS256']
    };
    jwt.verify(token, secret, jwtConfig, (err, res: any) => {
      if (err) {
        reject(err as Error);
      } else {
        const data: AuthData = {
          id: res.id,
          plan: res.plan,
          type: res.type,
          emailVerified: res.emailVerified
        };
        resolve(data);
      }
    });
  });
};
