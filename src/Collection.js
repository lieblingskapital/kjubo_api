// @flow

import { Schema, type SchemaDefinition, ValidationResult} from '@kjubo/schema';
import type Context from './Context';


import Store from './Store';
import ValidationError from './errors/ValidationError';

class Collection {
  store: Store;
  table: string;
  schema: Schema;

  static ValidationError = ValidationError;

  // default regex matches an uuid
  id_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  default_sort = null;

  constructor(store: Store, table: string, schema: SchemaDefinition) {
    this.store = store;
    this.table = table;
    this.schema = new Schema(schema);
  }

  validate(item: Object): Promise<ValidationResult> {
    return this.schema.validate(item);
  }

  get(id: string, context: Context) {
    // valid uuids only
    if (!id) return Promise.resolve(null);
    if (!this.id_regex.test(id)) return Promise.resolve(null);
    return this.store.db(this.table)
      .select('*')
      .limit(1)
      .where('id', id)
      .then((result) => {
        if (result[0]) return this.onGet(result[0], context);
        return null;
      });
  }

  find(query?: ?Object, context: Context): Promise<Array<Object>> {
    const { offset = 0, limit = 100, sort = this.default_sort } = context.req.query;
    let tmp = this.store.db(this.table).select('*').limit(limit).offset(offset);

    if(sort) {
      if(sort[0] === '-') {
        tmp.orderBy(sort.substring(1), 'desc');
      } else {
        tmp.orderBy(sort, 'asc');
      }
    }

    if (query) {
      tmp = tmp.where(query);
    }

    return tmp
      .then(result => Promise.all(result.map(item => this.onGet(item, context))))
      .then(result => result.filter(item => item !== null))
      // eslint-disable-next-line no-param-reassign
      .then((result) => { result.offset = offset; result.limit = limit; return result; });
  }

  query() {
    return this.store.db(this.table);
  }

  async create(item: Object, context: Context) {
    const result = await this.schema.validate(item);

    if (result.hasErrors()) {
      debugger;
      throw new ValidationError(result.getErrors());
    }

    return this
      .onCreate(result.getValues(), context)
      .then((_item) => {
        if (!_item) throw new Error('Item can not be empty');
        const insert = Object.keys(_item).reduce((prev, curr) => {
          if (typeof _item[curr] !== 'undefined') {
            // eslint-disable-next-line no-param-reassign
            prev[curr] = _item[curr];
          }
          return prev;
        }, {});
        return this.store.db(this.table)
          .insert(insert)
          .returning('*')
          .then(tmp => this.onGet(tmp[0], context));
      });
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async onGet(item: Object, context: Context): Promise<Object> {
    return Promise.resolve(item);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async onCreate(item: Object, context: Context): Promise<Object> {
    return Promise.resolve(item);
  }

  onHTTPPost(context: Context) {
    return this.create(context.req.body, context);
  }
}

export default Collection;
