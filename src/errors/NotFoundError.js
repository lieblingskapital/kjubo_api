// @flow

import ExtendableError from './ExtendableError';

class NotFoundError extends ExtendableError {
  constructor(item: string, collection: string, id: string) {
    super(`${item}(${id}) not found`);
  }
}

export default NotFoundError;
