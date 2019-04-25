'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ExtendableError = require('./ExtendableError');

var _ExtendableError2 = _interopRequireDefault(_ExtendableError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ValidationError = function ValidationError(errors) {
  _classCallCheck(this, ValidationError);

  this.message = 'Validation Failed';
  this.errors = errors;
};

exports.default = ValidationError;