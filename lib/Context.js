"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Context = function () {
	function Context(req, res) {
		var depth = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

		_classCallCheck(this, Context);

		this.req = req;
		this.res = res;
		this.depth = depth;

		// $FlowIgnore
		this.user = res.locals.user;
	}

	_createClass(Context, [{
		key: "stepInto",
		value: function stepInto() {
			return new Context(this.req, this.res, this.depth + 1);
		}
	}, {
		key: "isInternal",
		value: function isInternal() {
			return this.depth > 0;
		}
	}]);

	return Context;
}();

exports.default = Context;