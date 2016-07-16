'use strict';

(function(){

	// todo: remove "vars" variable

	window.Horns = function(str)
	{
		if(typeof str != 'string')
		{
			str = '';
		}

		this.str = str; // string to be parsed
		this.vars = { // some runtimes
			tag: false, // flag that indicates whether we are inside {{}} or not
			at: null, // current atom detected (replace with history) // todo: remove
			i: 0, // current parse position
			chunk: '', // a currently read part of static segment in template. every time by reaching {{ drops to ''
			helpers: {} // registered helpers
		};

		this.registerHelper('pseudo', function(arg){
			return arg;
		});
		this.buildStruct();
		delete(this.str);

		if(Horns.debugMode)
		{
			console.dir(this.struct);
		}
	};
	Horns.compile = function(str, name)
	{
		return new Horns(str);
	};
	Horns.toggleDebugMode = function(flag)
	{
		this.debugMode = flag;
	};
	Horns.render = function(name, data)
	{
		if(typeof this.registry == 'undefined')
		{
			this.registry = {};
		}

		if(typeof this.registry[name] == 'undefined')
		{
			var node = document.getElementById('horns-template-'+name);
			if(node)
			{
				this.registry[name] = this.compile(node.innerHTML, name);
			}
		}

		if(this.registry[name])
		{
			return this.registry[name].get(data);
		}
		else
		{
			return '';
		}
	};

	var proto;

	proto = Horns.prototype;

	// todo: Horns.prototype = {...}

	proto.getAtoms = function()
	{
		// todo
	};

	// todo: move to to getAtoms()
	proto.atoms = {
		sp: {
			find: function(i){
				return this.testSequence(i, '\\s');
			},
			// todo: for each "do": rename to append(), because "do" is a reserved word
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
			syn: {'icu':true,'sym':true,'sp':true}
		},
		io: {
			find: function(i){
				return this.testSubString(i, '{{');
			},
			do: function(){
				this.saveTextChunk();
				this.inTag(true, true);
			},
			syn: {'hash':true,'slash':true,'nested':true,'if':true,'elseif':true,'else':true,'endif':true, 'ic':true, 'sym':true,'sp':true},
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
			syn: {'io':true,'iou':true,'sp':true}
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
			syn: {'io':true,'iou':true,'sp':true}
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
		nested: {
			find: function(i){
				return this.testSubString(i, '>');
			},
			do: function(){
				this.struct.append(new Node.Instruction.NestedTemplate(this));
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
					this.struct.forward(new Node.Instruction.IfElse(this));
				}
			},
			syn: {'ic':true, 'sym':true,'sp':true}
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
			syn: {'sym':true,'sp':true}
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
			syn: {'ic':true,'sp':true}
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
		sym: {
			find: function(i){
				return this.testSequence(i, Symbol.getRegExp());
			},
			do: function(value, i){

				var spl = new Symbol(value, this);

				if(this.lastAtom() === null)
				{
					this.struct.append(new Node.Instruction(this, this.vars.tag.safe)); // add new Instruction to the struct
					this.struct.symbol(spl);
				}
				else if(this.lastAtom().atom == 'hash')
				{
					var node = new Node.Instruction.LogicLess(this);
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
		} // the last option: symbol, with allowed characters list
	};
	proto.atomList = []; // a list of atoms symbolic codes
	for(var k in proto.atoms)
	{
		proto.atomList.push(k);
	}

	proto.showError = function(message)
	{
		var i = this.vars.i + 1;
		message = message || '';

		var range = 30;
		var l = this.str.length;
		var leftRange = Math.min(range, i);
		var rightRange = i+range > l ? l - (i+range) : range;

		var chunk = (i > range ? '...' : '')+this.str.substr(i-leftRange, leftRange)+this.str.substr(i, rightRange)+(i+range < l ? '...' : '');
		var cap = (i > range ? '   ' : '')+' '.repeat(leftRange - 1)+'^';

		throw new Error('Parse error at '+i+': '+message+"\r\n"+chunk+"\r\n"+cap);
	};
	proto.buildStruct = function()
	{
		this.struct = new Structure(this); // struct to be built, for further usages

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
					this.evaluateAtom(next);
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
		var str = this.struct.tree.evaluate([], obj);

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
	proto.callHelper = function(name, args, ctx, data)
	{
		if(typeof this.vars.helpers[name] == 'undefined' || !Util.type.isFunction(this.vars.helpers[name]))
		{
			return ''; // todo: or may be null?
		}

		var helper = this.vars.helpers[name];
		var helperCtx = Util.dereferencePath(ctx, data);

		var hArgs = [];
		for(var k = 0; k < args.length; k++)
		{
			if(args[k].getValue().trim() == 'this')
			{
				hArgs.push(helperCtx);
			}
			else
			{
				hArgs.push(args[k].evaluate(ctx, data));
			}
		}

		hArgs.push(helperCtx); // append reference to helperCtx to the end of fn arguments
		
		return helper.apply(helperCtx, hArgs);
	};
	proto.inTag = function(change, safe)
	{
		if(typeof change != 'undefined')
		{
			if(Horns.debugMode && !change)
			{
				console.dir('-------------------------------');
			}

			this.vars.tag = change ? {safe: safe, atoms: []} : false;
		}
		else
		{
			return this.vars.tag !== false;
		}
	};
	proto.evaluateAtom = function(found)
	{
		return this.atoms[found.atom].do.apply(this, [found.value, this.vars.i, found.offset]);
	};
	proto.saveTextChunk = function()
	{
		if(this.vars.chunk != '')
		{
			this.struct.append(new Node.text(this.vars.chunk));
			this.vars.chunk = '';
		}
	};
	proto.appendChunk = function(i)
	{
		this.vars.chunk += this.str[i];
	};
	// test if this.str has substring that equals to str at position i
	// todo: move to Util
	proto.testSubString = function(i, str)
	{
		if(this.str.substr(i, str.length) == str)
		{
			return str;
		}
		return false;
	};
	// test if a substring of this.str that starts from i matches a given regular expression. if match, return it
	// todo: move to Util
	proto.testSequence = function(i, expr)
	{
		var inst = false;
		var r = this.str.substr(i, this.str.length - i).match(new RegExp('^('+expr+'+)'));
		if(r != null && typeof r[1] != 'undefined')
		{
			inst = r[1];
		}

		return inst;
	};
	// todo: move to Util
	proto.testKeyWord = function(i, word)
	{
		return this.testSequence(i, word+'(\\s+|\}\}|\$)') ? word : false;
	};
	proto.isExpectable = function(found) // todo: rename function to smth more appropriate
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

		return false;
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
				return null;
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
	proto.evaluate = function(ctx, data)
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
		this.nameReplaced = false;

		if(typeof arg != 'undefined')
		{
			this.args.push(arg);
		}
	};
	proto = FnCall.prototype;
	proto.addArgument = function(arg)
	{
		if(!this.nameReplaced) // if this FnCall is "pseudo", with one argument
		{
			if(!this.args[0].isSimple())
			{
				throw new ReferenceError('"'+this.args[0].getValue()+'" is not a valid function name');
			}
			else
			{
				this.name = this.args[0].getValue();
			}

			this.nameReplaced = true;
			this.args = [];
		}

		this.args.push(arg);
	};
	proto.evaluate = function(ctx, data)
	{
		return this.parser.callHelper(this.name, this.args, ctx, data);
	};

	// node types

	var Node = {};

	/////////////////////////////////////////
	// text node: 'Just some text'
	Node.text = function(val){
		this.value = val;
	};
	proto = Node.text.prototype;
	proto.evaluate = function(){
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
	Node.Instruction = function(parser, escape){
		this.escape = !!escape;
		this.sym = null;
		this.sub = [];

		this.parser = parser;
	};
	proto = Node.Instruction.prototype;
	proto.evaluate = function(ctx, data)
	{
		// call function
		var value = '';

		if(this.sym !== null)
		{
			value = this.sym.evaluate(ctx, data);
		}

		// call sub Instructions
		value += Node.Instruction.evaluateInstructionSet(this.sub, ctx, data);

		return this.escape ? Util.escape(value) : value;
	};
	proto.append = function(node)
	{
		this.sub.push(node);
	};
	proto.symbol = function(symbol)
	{
		if(this.sym == null)
		{
			this.sym = new FnCall(symbol, this.parser);
		}
		else
		{
			this.sym.addArgument(symbol);
		}
	};
	proto.get = function(i)
	{
		if(typeof i == 'undefined')
		{
			i = this.sub.length - 1;
		}
		return this.sub[i];
	};
	proto.atoms = function(){
	};
	proto.isExpectable = function(){
		return true;
	};
	Node.Instruction.evaluateInstructionSet = function(iSet, ctx, data)
	{
		var value = '';
		for(var k = 0; k < iSet.length; k++)
		{
			value += iSet[k].evaluate(ctx, data);
		}

		return value;
	};

	/////////////////////////////////////////
	// logic-less node: {{#inner}} {{...}} {{/inner}}
	Node.Instruction.LogicLess = function(parser){
		this.sub = []; // sub-instruction set
		this.condition = null; // conditional function call, it always will be pseudo FnCall
		this.conditionalSymbol = false; // instruction symbol, i.e. when {{#inner}} met it will be "inner"
		this.parser = parser; // link to horns object
	};
	proto = Node.Instruction.LogicLess.prototype;
	proto.evaluate = function(ctx, data)
	{
		var value = '';
		if(this.condition === null)
		{
			return value;
		}

		// calc logic less condition
		var result = this.condition.evaluate(ctx, data);
		// helper may return the following:
		// 1) iterable object or array. then instruction acts as each
		// 2) other stuff. then act as conditional operator, check if stuff is not falsie and enter\skip sub-instructions

		if(result)
		{
			var j = null;
			var resultKey = 'helper-result-'+Math.floor(Math.random()*100);

			if(Util.type.isIterableObject(result) || Util.type.isArray(result)) // array or object that supports iteration
			{
				var dRef = Util.dereferencePath(ctx, data);
				if(!Util.type.isPlainObject(dRef) && !Util.type.isArray(dRef))
				{
					return '';
				}

				dRef[resultKey] = result;
				ctx.push(resultKey);

				for(j = 0; j < result.length; j++)
				{
					ctx.push(j);
					value += Node.Instruction.evaluateInstructionSet(this.sub, ctx, data);
					ctx.pop();
				}

				ctx.pop();
				delete(dRef[resultKey]);
			}
			else if(result) // act as simple short conditional operator
			{
				value += Node.Instruction.evaluateInstructionSet(this.sub, ctx, data);
			}
		}

		return value;
	};
	proto.append = function(node)
	{
		this.sub.push(node);
	};
	proto.symbol = function(symbol)
	{
		if(this.condition == null)
		{
			this.conditionalSymbol = symbol;
			this.condition = new FnCall(symbol, this.parser);
		}
		else
		{
			this.condition.addArgument(symbol);
		}
	};
	proto.isExpectable = function(symbol)
	{
		return this.conditionalSymbol.getValue() == symbol.getValue(); // ensure that opening tag matches closing tag
	};
	proto.get = function(i)
	{
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
	// NestedTemplate template node: {{> templateName}}
	Node.Instruction.NestedTemplate = function(parser){
		this.name = false;
		this.ctxSymbol = false;
		this.parser = parser;
	};
	proto = Node.Instruction.NestedTemplate.prototype;
	proto.symbol = function(symbol){

		if(this.name === false)
		{
			this.name = symbol;
		}
		else if(this.ctxSymbol === false)
		{
			this.ctxSymbol = new FnCall(symbol, this.parser);
		}
		else
		{
			this.parser.showError('Unexpected symbol "'+symbol.getValue()+'"');
		}
	};
	proto.evaluate = function(ctx, data)
	{
		var value = '';

		if(this.name !== false)
		{
			var rData = null;
			if(this.ctxSymbol !== false)
			{
				rData = this.ctxSymbol.evaluate(ctx, data);
			}
			else
			{
				rData = Util.dereferencePath(ctx, data);
			}
			
			value = Horns.render(this.name.getValue(), rData);
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
	Node.Instruction.IfElse = function(parser){
		this.branches = [];
		this.newBranch();
		this.metElse = false;

		this.parser = parser;
	};
	proto = Node.Instruction.IfElse.prototype;
	proto.evaluate = function(ctx, data)
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
				res = br.cond.evaluate(ctx, data);
			}

			if(res)
			{
				value += Node.Instruction.evaluateInstructionSet(br.ch, ctx, data);
				break;
			}
		}

		return value;
	};
	proto.append = function(node)
	{
		this.getBranch().ch.push(node);
	};
	proto.symbol = function(symbol)
	{

		// todo: check that no symbol can go after 'else' atom

		var lastBr = this.getBranch();

		if(lastBr.cond == null)
		{
			lastBr.cond = new FnCall(symbol, this.parser);
		}
		else
		{
			lastBr.cond.addArgument(symbol);
		}
	};
	proto.newBranch = function()
	{
		this.branches.push({
			cond: null,
			ch: []
		});
	};
	proto.getBranch = function()
	{
		return this.branches[this.branches.length - 1];
	};
	proto.get = function(i)
	{
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
	proto.isExpectable = function(symbol)
	{
		if(symbol == 'endif')
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
	var Structure = function(parser)
	{
		this.current = new Node.Instruction(parser, false);
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
		return this.current instanceof Node.Instruction[type];
	};
	proto.isExpectable = function(symbol)
	{
		return this.current.isExpectable(symbol);
	};
	proto.atoms = function(symbol)
	{
		return this.current.atoms(symbol);
	};

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
			},
			isFunction: function(obj)
			{
				return Object.prototype.toString.call(obj) == '[object Function]';
			}
		},
		escape: function(value)
		{
			if(typeof value == 'undefined' || value === null)
			{
				return value;
			}

			return value.toString()
				.replace(/&/g, '&amp;')
				.replace(/"/g, '&quot;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		},
		dereferencePath: function(path, data)
		{
			var val = data;
			for(var k = 0; k < path.length; k++)
			{
				val = val[path[k]];
				if(typeof val == 'undefined' || val === null) // todo: remove val === null?
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
		}
	}

}).call(this);