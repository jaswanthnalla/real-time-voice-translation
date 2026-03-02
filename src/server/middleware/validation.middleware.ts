import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './error.middleware';
import { ERROR_CODES } from '../../shared/constants';

type RequestProperty = 'body' | 'params' | 'query';

export function validate(schema: Joi.ObjectSchema, property: RequestProperty = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      next(
        new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details)
      );
      return;
    }

    req[property] = value;
    next();
  };
}
