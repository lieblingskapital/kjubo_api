// @flow

import ExtendableError from './ExtendableError';

export default class ValidationError extends ExtendableError {
  errors: Object;

  constructor(errors: Object) {
    super('Validation failed');
    this.errors = errors;
  }
}
