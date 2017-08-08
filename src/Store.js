// @flow weak

import type { Knex } from 'knex';
import jwt from 'jsonwebtoken';
import type { Router, $Request, $Response, NextFunction } from 'express';
import { IDField, LinksField } from '@kjubo/schema';

import Collection from './Collection';
import Context from './Context';

import ValidationError from './errors/ValidationError';
import DatabaseError from './errors/DatabaseError';
import NotFoundError from './errors/NotFoundError';

class Store {
  collections: Map<string, Collection> = new Map();
  names: Map<string, string> = new Map();
  db: Knex;

  static JWT_SECRET = 'cQX[yD{_/%tv,f]zS9_O#~;h)o6{;@[G@as^/k^?<0qX@v7X=.<<k>pfI!(Cn$d';

  constructor(db: Knex) {
    this.db = db;
  }

  createCollection(item: string, name: string, Type: any, schema: ?SchemaDefinition = null) {
    const collection = (new Type(this, name, schema): Collection);
    this.collections.set(name, collection);
    this.names.set(name, item);
    return collection;
  }

  get(name: string): Collection {
    const collection = this.collections.get(name);
    if (!collection) {
      throw new Error(`Collection(${name}) does not exist`);
    }

    return collection;
  }

  static wrapper(handler): ($Request, $Response, any) => any {
    return async (req, res, next) => {
      try {
        const result = await handler(req, res);
        return res.status(200).json({
          status: 200,
          limit: result.limit,
          offset: result.offset,
          data: result,
        });
      } catch (err) {
        return next(err);
      }
    };
  }

  // eslint-disable-next-line no-unused-vars
  static handleErrors(err: ?Error, req: $Request, res: $Response, next: NextFunction) {
    // eslint-disable-next-line no-console
    console.error(err);
    if (err instanceof NotFoundError) {
      return res.status(404).json({
        status: 404,
        code: 'ENOT_FOUND',
        description: err.message,
      });
    } else if (err instanceof ValidationError) {
      return res.status(422).json({
        status: 422,
        code: 'EVALIDATION_FAILED',
        description: err.message,
        errors: err.errors,
      });
    } else if (err instanceof DatabaseError) {
      // TODO: Only give details on development
      return res.status(500).json({
        code: 'EINTERNAL_ERROR',
        error: err,
      });
    } else { // eslint-disable-line no-else-return
      return process.nextTick(() => {
        throw err;
      });
    }
  }

  static getToken(req: express$Request) {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      return req.query.token;
    }

    return null;
  }

  verifySession = (req: express$Request, res: express$Response, next: express$NextFunction) => {
    res.locals.user = null;

    const token = Store.getToken(req);
    if (!token) return next();

    return jwt.verify(token, Store.JWT_SECRET, (err, decoded) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return next();
      }

      return this.get('users').get(decoded.user.id, new Context(req, res)).then((user) => {
        res.locals.user = user;

        next();
      });
    });
  }

  // eslint-disable-next-line class-methods-use-this
  createSession(user: Object) {
    return new Promise((resolve, reject) => {
      jwt.sign({ user: { id: user.id } }, Store.JWT_SECRET, (err, token) => {
        if (err) return reject(err);
        return resolve(token);
      });
    });
  }


  connect(router: Router): void {
    router.use(this.verifySession);

    // eslint-disable-next-line arrow-body-style
    router.get('/current_user', Store.wrapper(async (req: express$Request, res: express$Response) => {
      return res.locals.user;
    }));

    router.use('/session', Store.wrapper(async (req: express$Request, res: express$Response) => {
      const email = req.body.email || req.query.email;

      const users = await this.get('users').find({ email }, new Context(req, res));
      if (!users.length) return res.end('OK');

      const user = users[0];
      const token = await this.createSession(user);

      return res.end(token);
    }));

    this.collections.forEach((collection, name) => {
      const paramName = this.names.get(name);

      if (!paramName) {
        throw new Error();
      }

      // eslint-disable-next-line max-len
      router.param(paramName, async (req: $Request, res: $Response, next: NextFunction, id: string) => {
        const item = await collection.get(id, new Context(req, res));
        if (!item) {
          return next(new NotFoundError(paramName, name, id));
        }

        req.params[paramName] = item;
        return next();
      });

      // eslint-disable-next-line no-unused-vars, arrow-body-style
      router.get(`/${name}`, Store.wrapper(async (req, res) => {
        return collection.find(null, new Context(req, res));
      }));

      // eslint-disable-next-line no-unused-vars, arrow-body-style
      router.get(`/${name}/:${paramName}`, Store.wrapper(async (req, res) => {
        return req.params[paramName];
      }));

      // eslint-disable-next-line no-unused-vars, arrow-body-style
      router.post(`/${name}`, Store.wrapper(async (req: express$Request, res: express$Response) => {
        return collection.onHTTPPost(new Context(req, res));
      }));

      collection.schema.fields.forEach((field: Field | LinksField | IDField) => {
        if (field instanceof IDField) {
          if (!field.references) return;

          // $FlowBug
          const otherParamName = this.names.get(field.references);
          const otherCollection = this.collections.get(field.references);

          /* eslint-disable no-unused-vars, arrow-body-style */
          // $FlowFixMe
          router.get(`/${field.references}/:${otherParamName}/${name}`, Store.wrapper(async (req, res) => {
            return collection.find({
              // $FlowFixMe
              [otherParamName]: req.params[otherParamName].id,
            }, new Context(req, res, 1));
          }));

          router.get(`/${name}/:${paramName}/${otherParamName}`, Store.wrapper(async (req, res) => {
            return otherCollection.get(req.params[paramName].source, new Context(req, res, 1));
          }));
          /* eslint-enable */
        } else if (field instanceof LinksField) {
          const otherParamName = this.names.get(field.collection);
          const otherCollection = this.collections.get(field.collection);

          /* eslint-disable no-unused-vars, arrow-body-style */
          router.get(`/${name}/:${paramName}/${field.name}`, Store.wrapper(async (req, res) => {
            const result = await this
              // $FlowIgnore
              .db(field.tablename)
              .select('*')
              .where({ [paramName]: req.params[paramName].id })

            if (typeof req.query.resolve === 'undefined') return result;

            return Promise.all(
              result.map(async ({ [otherParamName]: id, ...other }) => {
                const item = await otherCollection.get(id);
                return {
                  [otherParamName]: item,
                  ...other,
                };
              })
            );
          }));

          router.post(`/${name}/:${paramName}/${field.name}`, Store.wrapper(async (req, res) => {
            const other = await this
              // $FlowIgnore
              .get(field.collection)
              .get(req.body[otherParamName], new Context(req, res));

            if (!other) {
              throw new ValidationError({
                // $FlowIgnore
                [otherParamName]: `cannot link to ${otherParamName} that does not exist`,
              });
            }

            // $FlowIgnore
            const originalQuery = this.db(field.tablename)
              .insert({
                [paramName]: req.params[paramName].id,
                // $FlowIgnore
                [otherParamName]: other.id,
              }).toString();

            // eslint-disable-next-line max-length $FlowIgnore
            return this.db.raw(`${originalQuery} ON CONFLICT ON CONSTRAINT ${field.tablename}_pkey DO NOTHING RETURNING *`).then((r) => {
              if (!r.rows.length) {
                // $FlowIgnore
                return this.db(field.tablename).select('*').where({
                  [paramName]: req.params[paramName].id,
                  // $FlowIgnore
                  [otherParamName]: other.id,
                }).first();
              }

              return r.rows[0];
            });
          }));

          // eslint-disable-next-line max-length $FlowIgnore
          router.delete(`/${name}/:${paramName}/${field.name}/:${otherParamName}`, Store.wrapper(async (req, res) => {
            return this
              // $FlowIgnore
              .db(field.tablename)
              .delete()
              .where({
                [paramName]: req.params[paramName].id,
                // $FlowIgnore
                [otherParamName]: req.params[otherParamName].id,
              });
          }));
          /* eslint-enable */
        }
      });
    });

    router.use(Store.handleErrors);
  }
}

export default Store;
