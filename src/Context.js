//@flow

class Context {
	user: Object;
req: express$Request;
res: express$Response;
depth: number;

constructor(req: express$Request, res: express$Response, depth: number = 0) {
	this.req = req;
	this.res = res;
	this.depth = depth;

	// $FlowIgnore
	this.user = res.locals.user;
}

stepInto() {
	return new Context(this.req, this.res, this.depth + 1);
}

isInternal() {
	return this.depth > 0;
}
}

export default Context;
