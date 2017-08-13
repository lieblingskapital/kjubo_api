// @flow

import ExtendableError from './ExtendableError';

export default class ValidationError {
  errors: Object;
  message: string;

  constructor(errors: Object) {
    this.message = 'Validation Failed';
    this.errors = errors;
  }
}
