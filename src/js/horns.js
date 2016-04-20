(function(){

	Horns = function(str)
	{
		if(typeof str != 'string')
		{
			str = '';
		}

		this.str = str; // string to be parsed
		this.struct = new Structure(); // struct to be built, for further usages
		this.vars = { // some runtimes
			tag: false, // flag that indicates whether we are inside {{}} or not
			at: null, // current atom detected (replace with history)
			i: 0, // current parse position
			chunk: '', // a currently read part of static segment in template. every time by reaching {{ drops to ''
			helpers: { // registered helpers
				'pseudo': function(arg){
					return arg;
				}
			}
		};

		this.buildStruct();
		delete(this.str);

		if(Horns.debugMode)
		{
			console.dir(this.struct);
		}
	};
	Horns.compile = function(str, name)
	{
		var instance = new Horns(str);
		if(typeof name == 'string' && name.length)
		{
			registry[name] = instance;
		}

		return instance;
	};
	Horns.debug = function(flag)
	{
		this.debugMode = flag;
	};

	var proto;

	proto = Horns.prototype;
	proto.atoms = {
		sp: {
			find: function(i){
				return this.testSequence(i, '\\s');
			},
			do: function(){},
			syn: {'if':true,'elseif':true,'else':true,'endif':true,'io':true,'iou':true,'ic':true,'icu':true,'sym':true}
		},
		iou: {
			find: function(i){
				return this.testSubString(i, '{{{');
			},
			do: function(){
				this.saveTextChunk();
				this.inTag(true, false);
			},
			syn: {'icu':true,'sym':true,'sp':true},
		},
		io: {
			find: function(i){
				return this.testSubString(i, '{{');
			},
			do: function(){
				this.saveTextChunk();
				this.inTag(true, true);
			},
			syn: {'hash':true,'slash':true,'NestedTemplate':true,'if':true,'elseif':true,'else':true,'endif':true, 'ic':true, 'sym':true,'sp':true},
		},
		icu: {
			find: function(i){
				return this.testSubString(i, '}}}');
			},
			do: function()
			{
				if(this.vars.tag.safe) // entered to safe, exiting as unsafe?
				{
					this.showError('Unexpected "}}}"');
				}

				this.inTag(false); // going out of the Instruction
			},
			syn: {'io':true,'iou':true,'sp':true},
		},
		ic: {
			find: function(i){
				return this.testSubString(i, '}}');
			},
			do: function()
			{
				if(!this.vars.tag.safe) // entered to unsafe, exiting as safe?
				{
					this.showError('Unexpected "}}"');
				}

				this.inTag(false); // going out of the Instruction
			},
			syn: {'io':true,'iou':true,'sp':true},
		},
		hash: {
			find: function(i){
				return this.testSubString(i, '#');
			},
			do: function(){
			},
			syn: {'if':true,'each':true,'sym':true,'sp':true},
		},
		slash: {
			find: function(i){
				return this.testSubString(i, '/');
			},
			do: function(){
			},
			syn: {'if':true,'each':true,'sym':true,'sp':true},
		},
		NestedTemplate: {
			find: function(i){
				return this.testSubString(i, '>');
			},
			do: function(){
				this.struct.append(new NodeType.Instruction.NestedTemplate(this));
			},
			syn: {'sym':true,'sp':true}
		},
		'if': {
			find: function(i){
				return this.testKeyWord(i, 'if');
			},
			do: function()
			{
				if(this.lastAtom() !== null && this.lastAtom().atom == 'slash')
				{
					this.atoms.endif.do.apply(this); // "\if" is treated as "endif"
				}
				else
				{
					this.struct.forward(new NodeType.Instruction.IfElse(this));
				}
			},
			syn: {'ic':true, 'sym':true,'sp':true},
		},
		elseif: {
			find: function(i){
				return this.testKeyWord(i, 'elseif');
			},
			do: function(){
				if(!this.struct.isCurrent('IfElse') || !this.struct.isExpectable('elseif'))
				{
					this.showError('Unexpected "elseif"');
				}
				this.struct.atoms('elseif');
			},
			syn: {'sym':true,'sp':true},
		},
		'else': {
			find: function(i){
				return this.testKeyWord(i, 'else');
			},
			do: function(){
				if(!this.struct.isCurrent('IfElse') || !this.struct.isExpectable('else'))
				{
					this.showError('Unexpected "else"');
				}
				this.struct.atoms('else');
			},
			syn: {'ic':true,'sp':true},
		},
		endif: {
			find: function(i){
				return this.testKeyWord(i, 'endif');
			},
			do: function(){
				if(!this.struct.isCurrent('IfElse') || !this.struct.isExpectable('endif'))
				{
					this.showError('Unexpected "endif"');
				}
				this.struct.backward();
			},
			syn: {'ic':true,'sp':true}
		},

		// all other is SYMBOL. This rule must go at the end always
		sym: {
			find: function(i){
				return this.testSequence(i, Symbol.getRegExp());
			},
			do: function(value, i){

				var spl = new Symbol(value, this);

				if(this.lastAtom() === null)
				{
					this.struct.append(new NodeType.Instruction(this.vars.tag.safe, this)); // add new Instruction to the struct
					this.struct.symbol(spl);
				}
				else if(this.lastAtom().atom == 'hash')
				{
					var node = new NodeType.Instruction.LogicLess(this);
					node.symbol(spl);

					this.struct.forward(node);
				}
				else if(this.lastAtom().atom == 'slash')
				{
					if(!this.struct.isExpectable(spl))
					{
						this.showError('Unexpected "'+value+'"');
					}
					this.struct.backward();
				}
				else
				{
					this.struct.symbol(spl);
				}
			},
			syn: {'ic':true,'icu':true,'sym':true,'sp':true}
		}// introduce allowed characters here
	};
	proto.atomList = []; // a list of atoms symbolic codes
	for(var k in proto.atoms)
	{
		proto.atomList.push(k);
	}

	proto.walk = function(i, cb)
	{
		for(var k = i; k < this.str.length; k++)
		{
			if(cb.apply(this, [k]) === false)
			{
				break;
			}
		}
	};
	proto.lastAtom = function(found)
	{
		if(typeof found == 'undefined')
		{
			if(!this.vars.tag.atoms.length)
			{
				return null;
			}

			return this.vars.tag.atoms[this.vars.tag.atoms.length - 1];
		}
		else if(found !== null && found !== false && found.atom !== false)
		{
			if(this.vars.tag === false) // we must be just left the tag
			{
				return;
			}

			// spaces and brackets are useless, just skip
			if(found.atom != 'sp' && found.atom != 'io' && found.atom != 'ic' && found.atom != 'iou' && found.atom != 'icu')
			{
				this.vars.tag.atoms.push(found);
			}
		}
	};
	proto.detectAtom = function(i)
	{
		var found = false;
		var all = this.inTag() ? this.atomList : ['iou', 'io'];

		for(var k = 0; k < all.length; k++)
		{
			if(all[k].length == 0)
			{
				continue;
			}

			found = this.atoms[all[k]].find.apply(this, [i]);
			if(found !== false)
			{
				break;
			}
		}

		var result = {
			atom: false, // no atoms found
			value: null,
			offset: 1 // increase offset by 1
		};

		if(found === false) // nothing were found
		{
			if(this.inTag())
			{
				this.showError('Unexpected "'+this.str[i]+'"'); // nowhere to go
			}
		}
		else
		{
			result = {
				atom: 	all[k],
				value: 	found,
				offset: found.length // increase offset by atom value length
			};

			if(Horns.debugMode)
			{
				console.dir(result.offset+': '+result.atom+' ('+result.value+')');
			}

			// check if it was expected
			if(!this.isExpectable(result))
			{
				this.showError('Unexpected "'+result.value+'"');
			}
		}

		return result;
	};
	proto.showError = function(message, i)
	{
		if(typeof i == 'undefined')
		{
			i = this.vars.i;
		}

		i += 1;
		message = message || '';

		var range = 30;
		var l = this.str.length;
		var leftRange = Math.min(range, i);
		var rightRange = i+range > l ? l - (i+range) : range;

		var chunk = (i > range ? '...' : '')+this.str.substr(i-leftRange, leftRange)+this.str.substr(i, rightRange)+(i+range < l ? '...' : '');
		var cap = (i > range ? '   ' : '')+' '.repeat(leftRange - 1)+'^';

		throw new Error('Parse error at '+i+': '+message+"\r\n"+chunk+"\r\n"+cap);
	};
	proto.getStruct = function()
	{
		return this.struct;
	};
	proto.buildStruct = function()
	{
		if(this.str.length)
		{
			var i = 0;
			this.vars.i = 0;
			var next = null;
			while(true)
			{
				if(this.vars.i > this.str.length - 1)
				{
					this.saveTextChunk();
					return this.struct; // parse end
				}

				if(i >= this.str.length)
				{
					throw new Error('Endless loop detected');
				}

				next = this.detectAtom(this.vars.i);
				if(next.atom != false)
				{
					// do atoms action
					this.evalAtom(next);
					this.lastAtom(next); // save atom just found
				}
				else
				{
					if(!this.inTag())
					{
						this.appendChunk(this.vars.i); // we are not inside of some Instruction, then append the symbol to the text chunk
					}
				}

				this.vars.i += next.offset;
				i++;
			}
		}
	};
	proto.get = function(obj)
	{
		var str = this.struct.tree.eval([], obj);

		if(Horns.debugMode)
		{
			console.dir(str);
		}

		return str;
	};
	proto.registerHelper = function(name, cb)
	{
		if(typeof name == 'string' && name.length > 0 && typeof cb == 'function')
		{
			this.vars.helpers[name] = cb;
		}
	};
	proto.inTag = function(sw, safe)
	{
		if(typeof sw != 'undefined')
		{
			if(Horns.debugMode && !sw)
			{
				console.dir('-------------------------------');
			}

			this.vars.tag = sw ? {safe: safe, atoms: []} : false;
		}
		else
		{
			return this.vars.tag !== false;
		}
	};
	proto.evalAtom = function(found)
	{
		return this.atoms[found.atom].do.apply(this, [found.value, this.vars.i, found.offset]);
	};
	proto.saveTextChunk = function()
	{
		if(this.vars.chunk != '')
		{
			this.struct.append(new NodeType.static(this.vars.chunk));
			this.vars.chunk = '';
		}
	};
	proto.appendChunk = function(i)
	{
		this.vars.chunk += this.str[i];
	};
	// test if this.str has substring that equal to str at position i
	proto.testSubString = function(i, str)
	{
		if(this.str.substr(i, str.length) == str)
		{
			return str;
		}
		return false;
	};
	// test if a substring of this.str that starts from i matches a given regular expression. if match, return it
	proto.testSequence = function(i, expr)
	{
		var inst = false;
		var r = this.str.substr(i, this.str.length - i).match(new RegExp('^('+expr+'+)'));
		if(r != null && typeof r[1] != 'undefined')
		{
			inst = r[1];
		}

		if(inst === false)
		{
			return false;
		}

		return inst;
	};
	proto.testKeyWord = function(i, word)
	{
		return this.testSequence(i, word+'(\\s+|\}\}|\$)') ? word : false;
	};
	proto.isExpectable = function(found)
	{
		if(!this.inTag())
		{
			return true;
		}
		else
		{
			var lastAtom = this.lastAtom();
			if(lastAtom == null) // first atom in the tag
			{
				return true;
			}
			else
			{
				return typeof this.atoms[lastAtom.atom].syn[found.atom] != 'undefined';
			}
		}
	};

	// symbol
	var Symbol = function(value, parser)
	{
		this.parser = parser;
		this.value = value.toString().trim();

		var found = this.value.match(new RegExp('^'+Symbol.getRegExp()));
		found = Array.prototype.slice.call(found);

		this.path = found.pop(); // get symbol name

		// calc count of "../"
		this.back = 0;
		var k, sub;
		for(k = 0; k < value.length;)
		{
			sub = value.substr(k, 3);
			k += 3;
			if(sub == '../')
			{
				this.back++;
			}
			else
			{
				break;
			}
		}

		// parse symbol sequence
		this.path = this.parseSeqence(this.path);
	};
	proto = Symbol.prototype;
	proto.isSimple = function()
	{
		return this.back == 0 && this.path.length == 1;
	};
	proto.absolutizePath = function(base)
	{
		var k = 0;
		var result = Util.clone(base);

		// resolve "../" symbols relative to base
		if(result.length && this.back)
		{
			for(k = 0; k < this.back; k++)
			{
				result.pop();
				if(!result.length)
				{
					break;
				}
			}
		}

		// attach symbol path
		for(k = 0; k < this.path.length; k++)
		{
			result.push(this.path[k]);
		}

		return result;
	};
	proto.parseSeqence = function(sequence)
	{
		var sq = sequence.toString().split('.');

		var offs = 0;
		for(k = 0; k < sq.length; k++)
		{
			if(sq[k].length == 0)
			{
				this.parser.showError('Unexpected "." (dot)');
			}
			offs += sq[k].length + 1;
		}

		return sq;
	};
	proto.eval = function(ctx, data)
	{
		var path = this.absolutizePath(ctx);

		return Util.dereferencePath(path, data);
	};
	proto.getValue = function()
	{
		return this.value;
	};
	Symbol.getRegExp = function()
	{
		return '(\.\./)*([a-zA-Z0-9_\\.]+)';
	};

	// helper call
	var FnCall = function(arg, parser)
	{
		this.name = 'pseudo';
		this.args = [];
		this.parser = parser;

		if(typeof arg != 'undefined')
		{
			this.args.push(arg);
		}
	};
	proto = FnCall.prototype;
	proto.addArg = function(symbol)
	{
		if(this.args.length == 1)
		{
			if(!this.args[0].isSimple())
			{
				throw new ReferenceError('"'+this.args[0].getValue()+'" is not a valid function name');
			}
			else
			{
				this.name = this.args[0].getValue();
			}

			this.args = [];
		}

		this.args.push(symbol);
	};
	proto.eval = function(ctx, data)
	{
		var hName = '';
		var args = this.args;

		if(typeof this.parser.vars.helpers[this.name] == 'undefined')
		{
			return '';
		}

		var hArgs = [];
		for(var k = 0; k < this.args.length; k++)
		{
			hArgs.push(this.args[k].eval(ctx, data));
		}

		return this.parser.vars.helpers[this.name].apply(Util.dereferencePath(ctx, data), hArgs);
	};

	// node types

	var NodeType = {};

	/////////////////////////////////////////
	// text node: 'Just some text'
	NodeType.static = function(val){
		this.value = val;
	};
	proto = NodeType.static.prototype;
	proto.eval = function(){
		return this.value;
	};
	proto.append = function(){
	};
	proto.symbol = function(){
	};
	proto.get = function(i){
	};
	proto.atoms = function(i){
	};
	proto.isExpectable = function(){
		return true;
	};

	/////////////////////////////////////////
	// Instruction node: {{varName}} or {{{varName}}}
	NodeType.Instruction = function(escape, parser){
		this.escape = !!escape;
		this.sym = null;
		this.sub = [];

		this.parser = parser;
	};
	proto = NodeType.Instruction.prototype;
	proto.eval = function(ctx, data)
	{
		// call function
		var value = '';

		if(this.sym !== null)
		{
			value = this.sym.eval(ctx, data);
		}

		// call sub Instructions
		for(var k = 0; k < this.sub.length; k++)
		{
			value += this.sub[k].eval(ctx, data);
		}

		return value;
	};
	proto.append = function(node){
		this.sub.push(node);
	};
	proto.symbol = function(symbol){
		if(this.sym == null)
		{
			this.sym = new FnCall(symbol, this.parser);
		}
		else
		{
			this.sym.addArg(symbol);
		}
	};
	proto.get = function(i){
		if(typeof i == 'undefined')
		{
			i = this.sub.length - 1;
		}
		return this.sub[i];
	};
	proto.atoms = function(i){
	};
	proto.isExpectable = function(){
		return true;
	};

	/////////////////////////////////////////
	// logic-less node: {{#inner}} {{...}} {{/inner}}
	NodeType.Instruction.LogicLess = function(parser){
		this.sub = []; // sub-instruction set
		this.condition = null; // conditional function call, it always will be pseudo FnCall
		this.conditionalSymbol = false; // instruction symbol, i.e. when {{#inner}} met it will be "inner"
		this.parser = parser; // link to horns object
	};
	proto = NodeType.Instruction.LogicLess.prototype;
	proto.eval = function(ctx, data)
	{
		// calc logic less condition
		var result = this.condition.eval(ctx, data);
		// helper may return the following:
		// 1) iterable object or array. then instruction acts as each
		// 2) other stuff. then act as conditional operator, check if stuff is not falsie and enter\skip sub-instructions

		var value = '';
		if(result)
		{
			var j = null;
			var resultKey = 'helper-result-'+Math.floor(Math.random()*100);

			if(Util.type.isIterableObject(result) || Util.type.isArray(result)) // array or object that supports iteration
			{
				data[resultKey] = result;
				ctx.push(resultKey);

				for(j = 0; j < result.length; j++)
				{
					ctx.push(j);
					value += Structure.evalInstructionSet(this.sub, ctx, data);
					ctx.pop();
				}

				ctx.pop();
				delete(data[resultKey]);
			}
			else if(result) // act as simple short conditional operator
			{
				value += Structure.evalInstructionSet(this.sub, ctx, data);
			}
		}

		return value;
	};
	proto.append = function(node){
		this.sub.push(node);
	};
	proto.symbol = function(symbol){
		if(this.condition == null)
		{
			this.conditionalSymbol = symbol;
			this.condition = new FnCall(symbol, this.parser);
		}
		else
		{
			this.parser.showError('Unexpected symbol "'+symbol+'"');
		}
	};
	proto.isExpectable = function(symbol){
		return this.conditionalSymbol.getValue() == symbol.getValue(); // ensure that opening tag matches closing tag
	};
	proto.get = function(i){
		if(this.sub.length == 0)
		{
			return this;
		}
		else
		{
			return this.sub[this.sub.length - 1];
		}
	};

	/////////////////////////////////////////
	// NestedTemplate template node: {{> nestedTemplate}}
	NodeType.Instruction.NestedTemplate = function(parser){
		this.name = false;
		this.sym = false;
		this.parser = parser;
	};
	proto = NodeType.Instruction.NestedTemplate.prototype;
	proto.symbol = function(symbol){

		if(this.name === false)
		{
			this.name = symbol;
		}
		else if(this.sym === false)
		{
			this.sym = new FnCall(symbol, this.parser);
		}
		else
		{
			this.parser.showError('Unexpected symbol "'+symbol+'"');
		}
	};
	proto.eval = function(ctx)
	{
		var value = '';

		if(this.name !== false)
		{
			var template = registry[this.name];
			if(template)
			{
				if(this.sym !== false)
				{
					//ctx = this.parser.callHelper(this.sym, ctx);
					ctx = this.sym.eval(ctx);
				}

				value = template.get(ctx);
			}
		}

		return value;
	};
	proto.get = function(){
		return this;
	};
	proto.isExpectable = function(){
		return true;
	};

	/////////////////////////////////////////
	// conditional operator node: {{#if smth}} ... {{else}} ... {{/if}} or {{if smth}} ... {{elseif anoter}} ... {{else}} ... {{endif}}
	NodeType.Instruction.IfElse = function(parser){
		this.branches = [];
		this.newBranch();
		this.metElse = false;

		this.parser = parser;
	};
	proto = NodeType.Instruction.IfElse.prototype;
	proto.eval = function(ctx)
	{
		var value = '';

		for(var k = 0; k < this.branches.length; k++)
		{
			var br = this.branches[k];
			var res = false;
			if(br.cond === null)
			{
				res = true; // suppose it is 'else'
			}
			else
			{
				//res = this.parser.callHelper(br.cond, ctx);
				res = bt.cond.eval(ctx);
			}

			if(res)
			{
				// call sub Instructions
				for(var k = 0; k < br.ch.length; k++)
				{
					value += br.ch[k].eval(ctx);
				}

				break;
			}
		}

		return value;
	};
	proto.append = function(node){
		this.getBranch().ch.push(node);
	};
	proto.symbol = function(symbol){

		// todo: check that no symbol can go after 'else' atoms

		var lastBr = this.getBranch();

		if(lastBr.cond == null)
		{
			lastBr.cond = new FnCall(symbol, this.parser);
		}
		else
		{
			lastBr.cond.addArg(symbol);
		}
	};
	proto.newBranch = function(){
		this.branches.push({
			cond: null,
			ch: []
		});
	};
	proto.getBranch = function(){
		return this.branches[this.branches.length - 1];
	};
	proto.get = function(i){
		var br = this.getBranch();
		if(br.ch.length == 0)
		{
			return this;
		}
		else
		{
			return br.ch[br.ch.length - 1];
		}
	};
	proto.isExpectable = function(atom)
	{
		if(atom == 'endif')
		{
			return true;
		}
		return !this.metElse;
	};
	proto.atoms = function(atom){
		if(atom == 'elseif' || atom == 'else')
		{
			this.newBranch();
		}
		if(atom == 'else')
		{
			this.metElse = true;
		}
	};

	// structure
	var Structure = function()
	{
		this.current = new NodeType.Instruction();
		this.tree = this.current;
	};
	proto = Structure.prototype;
	proto.forward = function(node)
	{
		this.append(node);
		this.current = node;
	};
	proto.append = function(node)
	{
		node.parent = this.current;
		this.current.append(node);
	};
	proto.backward = function()
	{
		this.current = this.current.parent;
	};
	proto.symbol = function(sym)
	{
		this.current.get().symbol(sym);
	};
	proto.get = function(){
		return this.current.get();
	};
	proto.isCurrent = function(type)
	{
		if(type == 'Instruction')
		{
			return this.current instanceof NodeType.Instruction;
		}

		return this.current instanceof NodeType.Instruction[type];
	};
	proto.isExpectable = function(atom)
	{
		return this.current.isExpectable(atom);
	};
	proto.atoms = function(atom)
	{
		return this.current.atoms(atom);
	};
	Structure.evalInstructionSet = function(iSet, ctx, data)
	{
		var value = '';
		for(var k = 0; k < iSet.length; k++)
		{
			value += iSet[k].eval(ctx, data);
		}

		return value;
	};

	var registry = {};

	var Util = {
		type: {
			isArray: function(obj){
				return Object.prototype.toString.call(obj) == '[object Array]'
			},
			isPlainObject: function(obj){
				return Object.prototype.toString.call(obj) == '[object Object]';
			},
			isIterableObject: function(obj)
			{
				return this.isPlainObject(obj) && 'length' in obj && obj.length > 0 && typeof obj[0] != 'undefined';
			}
		},
		isFalsie: function(arg)
		{
			return typeof arg == 'undefined' || arg === null || arg === false;
		},
		dereferencePath: function(path, data)
		{
			var val = data;
			for(var k = 0; k < path.length; k++)
			{
				val = val[path[k]];
				if(typeof val == 'undefined' || val === null)
				{
					return '';
				}
			}

			return val;
		},
		clone: function(arg)
		{
			var result = null;
			var k = 0;

			if(Util.type.isArray(arg))
			{
				result = [];
				for(k = 0; k < arg.length; k++)
				{
					result[k] = Util.clone(arg[k]);
				}
			}
			else if(Util.type.isPlainObject(arg))
			{
				result = {};
				for(k in arg)
				{
					if(arg.hasOwnProperty(k))
					{
						result[k] = Util.clone(arg[k]);
					}
				}
			}
			else
			{
				result = arg;
			}

			return result;
		},
	}

}).call(this);