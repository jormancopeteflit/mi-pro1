import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: error.details.map((d) => ({ field: d.context?.key, message: d.message })),
      });
      return;
    }
    req.body = value;
    next();
  };
}
