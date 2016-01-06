Template = function (str)
{
	this.str = str.toString();
	this.struct = new Template.Struct();

	// each atom may be followed with space (sp), and space may be follewed with any instruction
	// atoms like "io", "iou" change context to 'instruction' and atoms "ic" and "icu" change context back to "text"
	// if "io" atom met, it must not be followed with "icu" or "iou" or another "io". The same rule for "iou"
	// a sequence of sym, symd and sp represents "symbol sequence", which lately should be mapped to either one of known helpers or a part of data object
	this.atom = {
		sp: {
			find: 	function(i){
				return this.findSeq(i, '\\s');
			},
			do: 	function(){},
			syn: 	['if_','elseif','el','endif', 'io', 'iou', 'ic','icu', 'sym','','','','','','','','']
		},
		iou: {
			find: 	function(i){
				return this.substr(i, '{{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.isInst(true, false);
			},
			syn: 	['icu','sym','','','','','','','','',],
		},
		io: {
			find: 	function(i){
				return this.substr(i, '{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.isInst(true, true);
			},
			syn: 	['if_','elseif','el','endif', 'ic', 'sym','','','','','','','',''], // order is important, sym must go at the end as the last chance character to be recognized
		},
		icu: {
			find: 	function(i){
				return this.substr(i, '}}}');
			},
			do: 	function(){
				// todo: check there was an {{{ instruction, not {{
				this.isTxt(true);
			},
			syn: 	['io','iou','','','','','','','',],
		},
		// instruction close }}
		ic: {
			find: 	function(i){
				return this.substr(i, '}}');
			},
			do: 	function(){
				// todo: check there was an {{ instruction, not {{{
				this.isTxt(true);
			},
			syn: 	['io','iou','','','','','','','',],
		},
		// if
		if_: {
			find: 	function(i){
				return this.substr(i, 'if ');
			},
			do: 	function(){
				this.struct.forward(new Template.node.instruction.ifelse(this));
			},
			syn: 	['sym','','','','','','','','',],
		},
		// elseif
		elseif: {
			find: 	function(i){
				return this.substr(i, 'elseif ');
			},
			do: 	function(){
				if(!this.struct.isCurrent('ifelse') || !this.struct.isExpectable('elseif'))
				{
					throw new Error('Unexpected elseif at '+i);
				}
				this.struct.atom('elseif');
			},
			syn: 	['sym','','','','','','','','',],
		},
		// else
		el: {
			find: 	function(i){
				return this.substr(i, 'else');
			},
			do: 	function(){
				if(!this.struct.isCurrent('ifelse') || !this.struct.isExpectable('else'))
				{
					throw new Error('Unexpected else at '+i);
				}
				this.struct.atom('else');
			},
			syn: 	['ic','','','','','','','','',],
		},
		// endif
		endif: {
			find: 	function(i){
				return this.substr(i, 'endif');
			},
			do: 	function(){
				if(!this.struct.isCurrent('ifelse') || !this.struct.isExpectable('endif'))
				{
					throw new Error('Unexpected endif at '+i);
				}
				this.struct.backward();
			},
			syn: 	['ic','','','','','','','','',]
		},

		// all other is SYMBOL, goes at the end
		sym: {
			find: 	function(i){
				return this.findSeq(i, '[a-zA-Z0-9_\\.]');
			},
			do: 	function(value, i){

				var spl = value.split('.');

				// parse symbol sequence
				var offs = 0;
				for(var k = 0; k < spl.length; k++)
				{
					if(spl[k].length == 0)
					{
						throw new Error('Unexpected dot at '+(i + offs));
					}
					offs += spl[k].length+1;
				}

				if(this.vars.instructionDetected != false)
				{
					this.struct.append(new Template.node.instruction(this.vars.instructionDetected == 'E', this));
				}
				this.struct.symbol(spl);
			},
			syn: 	['ic','icu','','','','','','','',],
		},// introduce allowed characters here
	}

	var all = [];
	for(var k in this.atom)
	{
		if(k != 'sp')
		{
			this.atom[k].syn.push('sp');
		}
		all.push(k);

		var synRev = {};
		for(var j = 0; j < this.atom[k].syn.length; j++)
		{
			var m = this.atom[k].syn[j];
			if(m != '')
			{
				synRev[m] = true;
			}
		}
		this.atom[k].synR = synRev;
	}

	this.vars = {
		ctxIns: 					false,
		at: 						null,
		chunk: 				'',
		all: 					all,
		instructionDetected: 	false,
		helpers: 				{
			'pseudo': function(arg){
				return arg;
			}
		}
	}

	this.compile();
}
Template.prototype.walk = function(i, cb)
{
	for(var k = i; k < this.str.length; k++)
	{
		if(cb.apply(this, [k]) === false)
		{
			break;
		}
	}
}
Template.prototype.detectAtom = function(i)
{
	var ctx = this.vars.ctx;
	var at = this.vars.at;
	var expect = null;
	var found = false;
	var all = this.isTxt() ? ['iou','io'] : this.vars.all;

	for(var k = 0; k < all.length; k++)
	{
		if(all[k].length == 0)
		{
			continue;
		}

		//if(this.isInst()) console.dir('check for '+all[k]);

		found = this.atom[all[k]].find.apply(this, [i]);
		if(found !== false)
		{
			break;
		}
	}

	if(found === false) // nothing were found
	{
		if(this.isInst())
		{
			throw new Error('Parse error at '+i);
		}
		else
		{
			return {
				atom: false,
				offs: 1
			};
		}
	}
	else
	{
		//console.dir('>>>>> at '+i+' found: '+all[k]+' with offset '+found.offs+' and value '+found.inst);console.dir(at);

		// check if it was expected
		if(!this.isExpectable(all[k], at))
		{
			throw new Error('Unexpected '+all[k]);
		}

		this.vars.at = all[k];

		return {
			atom: 	all[k],
			val: 	found.inst,
			offs: 	found.offs
		};
	}
}
Template.prototype.getStruct = function()
{
	return this.struct;
}
Template.prototype.compile = function()
{
	if(this.str.length)
	{
		var i = 0;
		var j = 0;
		var next = null;
		while(true)
		{
			if(j >= this.str.length - 1)
			{
				this.saveTextChunk();
				return this.struct; // parse end
			}

			if(i >= this.str.length)
			{
				throw new Error('Internal: endless loop');
			}

			next = this.detectAtom(j);
			if(next.atom != false)
			{
				var detectedBefore = this.vars.instructionDetected;
				// do atom action
				this.evalAtom(next, j);
				if(detectedBefore != false && next.atom != 'sp')
				{
					this.vars.instructionDetected = false;
				}
			}
			else
			{
				if(this.isTxt())
				{
					this.appendChunk(j);
				}
			}

			j += next.offs;
			i++;
		}
	}
}
Template.prototype.get = function(obj)
{
	return this.struct.tree.eval(obj);
}
Template.prototype.registerHelper = function(name, cb)
{
	if(typeof name == 'string' && name.length > 0 && typeof cb == 'function')
	{
		this.vars.helpers[name] = cb;
	}
}
Template.prototype.isTxt = function(sw)
{
	if(sw)
	{
		this.vars.ctxIns = false;
	}

	return !this.vars.ctxIns;
}
Template.prototype.isInst = function(sw, escape)
{
	if(sw)
	{
		this.vars.ctxIns = true;
		this.vars.instructionDetected = escape ? 'E' : 'N';
	}

	return this.vars.ctxIns;
}
Template.prototype.evalAtom = function(found, j)
{
	return this.atom[found.atom].do.apply(this, [found.val, j, found.offs]);
}
Template.prototype.saveTextChunk = function()
{
	if(this.vars.chunk != '')
	{
		this.struct.append(new Template.node.static(this.vars.chunk));
		this.vars.chunk = '';
	}
}
Template.prototype.appendChunk = function(i)
{
	this.vars.chunk += this.str[i];
}
Template.prototype.substr = function(i, str)
{
	if(this.str.substr(i, str.length) == str)
	{
		return {
			offs: str.length,
			inst: str
		}
	}
	return false;
}
Template.prototype.findSeq = function(i, expr)
{
	var expr = new RegExp('^('+expr+'+)');
	var substr = this.str.substr(i, this.str.length - i);

	var inst = false;
	var r = substr.match(expr);
	if(r != null && typeof r[1] != 'undefined')
	{
		inst = r[1];
	}

	if(inst === false)
	{
		return false;
	}

	return {
		offs: inst.length,
		inst: inst
	}
}
Template.prototype.isExpectable = function(atom, afterAtom)
{
	if(afterAtom == null)
	{
		return true;
	}

	return typeof this.atom[afterAtom].synR[atom] != 'undefined';
}

// struct

Template.Struct = function(){
	this.current = new Template.node.instruction();
	this.tree = this.current;
}
Template.Struct.prototype.forward = function(node){
	this.append(node);
	this.current = node;
}
Template.Struct.prototype.append = function(node){
	node.parent = this.current;
	this.current.append(node);
}
Template.Struct.prototype.backward = function(){
	this.current = this.current.parent;
}
Template.Struct.prototype.symbol = function(sym){
	this.current.get().symbol(sym);
}
Template.Struct.prototype.get = function(){
	return this.current.get();
}
Template.Struct.prototype.isCurrent = function(type){

	if(type == 'instruction')
	{
		return this.current instanceof this.instruction;
	}

	return this.current instanceof node.instruction[type];
}
Template.Struct.prototype.isExpectable = function(atom){
	return this.current.isExpectable(atom);
}
Template.Struct.prototype.atom = function(atom){
	return this.current.atom(atom);
}

Template.func = function(arg, name){
	this.name = typeof name == 'undefined' ? 'pseudo' : name;
	this.args = [];

	if(typeof arg != 'undefined')
	{
		this.args.push(arg);
	}
}
Template.func.prototype.addArg = function(symbol){
	if(this.name == 'pseudo' && this.args.length == 1)
	{
		if(this.args[0].length > 1)
		{
			throw new Error(this.args[0].join('.')+' is not a valid function name');
		}

		this.name = this.args[0][0];
		this.args = [];
	}

	this.args.push(symbol);
}

// types of node

var node = {};
Template.node = node;

// text node
node.static = function(val){
	this.value = val;
}
node.static.prototype.eval = function(){
	return this.value;
}
node.static.prototype.append = function(){
}
node.static.prototype.symbol = function(){
}
node.static.prototype.get = function(i){
}
node.static.prototype.atom = function(i){
}

// instruction node
node.instruction = function(escape, parser){
	this.escape = !!escape;
	this.sym = null;
	this.ch = [];

	this.parser = parser;
}
node.instruction.prototype.eval = function(obj){

	// call function
	var value = '';

	if(this.sym !== null)
	{
		var hName = '';
		var args = [];

		if(this.sym.name == 'pseudo' && this.sym.args.length == 1)
		{
			// special case: test if argument is a function name
			var arg = this.sym.args[0];
			if(arg.length == 1 && typeof this.parser.vars.helpers[arg[0]] != 'undefined')
			{
				hName = arg[0];
				args = [obj];
			}
			else
			{
				hName = 'pseudo';
				args = [this.evalSymbol(this.sym.args[0], obj)];
			}
		}
		else
		{
			hName = this.sym.name;
			for(var k = 0; k < this.sym.args.length; k++)
			{
				args.push(this.evalSymbol(this.sym.args[k], obj));
			}
		}

		if(typeof this.parser.vars.helpers[hName] == 'undefined')
		{
			throw new Error('Unknown helper '+hName);
		}

		value = this.parser.vars.helpers[hName].apply(obj, args);
	}

	// call sub instructions
	for(var k = 0; k < this.ch.length; k++)
	{
		value += this.ch[k].eval(obj);
	}

	console.dir(value);

	return value;
}
node.instruction.prototype.evalSymbol = function(sym, obj){
	var val = obj;
	for(var k = 0; k < sym.length; k++)
	{
		val = val[sym[k]];
		if(typeof val == 'undefined')
		{
			return '';
		}
	}

	return val;
}
node.instruction.prototype.append = function(node){
	this.ch.push(node);
}
node.instruction.prototype.symbol = function(symbol){
	if(this.sym == null)
	{
		this.sym = new Template.func(symbol);
	}
	else
	{
		this.sym.addArg(symbol);
	}
}
node.instruction.prototype.get = function(i){
	if(typeof i == 'undefined')
	{
		i = this.ch.length - 1;
	}
	return this.ch[i];
}
node.static.prototype.atom = function(i){
}

// if node
node.instruction.ifelse = function(parser){
	this.branches = [];
	this.newBranch();
	this.metElse = false;

	this.parser = parser;
}
node.instruction.ifelse.prototype.eval = function(){
}
node.instruction.ifelse.prototype.append = function(node){
	this.getBranch().ch.push(node);
}
node.instruction.ifelse.prototype.symbol = function(symbol){

	// todo: check that no symbol can go after 'else' atom

	var lastBr = this.getBranch();

	if(lastBr.cond == null)
	{
		lastBr.cond = new Template.func(symbol);
	}
	else
	{
		lastBr.cond.addArg(symbol);
	}
}
node.instruction.ifelse.prototype.newBranch = function(){
	this.branches.push({
		cond: null,
		ch: []
	});
}
node.instruction.ifelse.prototype.getBranch = function(){
	return this.branches[this.branches.length - 1];
}
node.instruction.ifelse.prototype.get = function(i){
	var br = this.getBranch();
	if(br.ch.length == 0)
	{
		return this;
	}
	else
	{
		return br.ch[br.ch.length - 1];
	}
}
node.instruction.ifelse.prototype.isExpectable = function(atom)
{
	if(atom == 'endif')
	{
		return true;
	}
	return !this.metElse;
}
node.instruction.ifelse.prototype.atom = function(atom){
	if(atom == 'elseif' || atom == 'else')
	{
		this.newBranch();
	}
	if(atom == 'else')
	{
		this.metElse = true;
	}
}