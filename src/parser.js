(function(){

	Horns = function(str)
	{
		if(typeof str == 'undefined' || str === null)
		{
			throw new TypeError('A bit questionable');
		}

		this.str = str.toString(); // todo: do not keep this.str, keep only struct insted
		this.struct = new Horns.Struct();
		this.vars = {
			ctxIns: 					false,
			at: 						null,
			chunk: 				'',
			all: 					Horns.prototype.atoms, // tmp
			instructionDetected: 	false,
			helpers: 				{
				'pseudo': function(arg){
					return arg;
				}
			}
		};

		this.buildStruct();
	};
	Horns.compile = function(str)
	{
		return new Horns(str);
	};

	var p = Horns.prototype;
	p.atoms = {
		sp: {
			find: 	function(i){
				return this.findSeq(i, '\\s');
			},
			do: 	function(){},
			syn: 	{'if_':true,'elseif':true,'el':true,'endif':true,'io':true,'iou':true,'ic':true,'icu':true,'sym':true}
		},
		iou: {
			find: 	function(i){
				return this.substr(i, '{{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.isInst(true, false);
			},
			syn: 	{'icu':true,'sym':true,'sp':true},
		},
		io: {
			find: 	function(i){
				return this.substr(i, '{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.isInst(true, true);
			},
			syn: 	{'if_':true,'elseif':true,'el':true,'endif':true, 'ic':true, 'sym':true,'sp':true},
		},
		icu: {
			find: 	function(i){
				return this.substr(i, '}}}');
			},
			do: 	function(){
				// todo: check there was an {{{ instruction, not {{
				this.isTxt(true);
			},
			syn: 	{'io':true,'iou':true,'sp':true},
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
			syn: 	{'io':true,'iou':true,'sp':true},
		},
		// if
		if_: {
			find: 	function(i){
				return this.substr(i, 'if ');
			},
			do: 	function(){
				this.struct.forward(new Horns.node.instruction.ifelse(this));
			},
			syn: 	{'sym':true,'sp':true},
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
				this.struct.atoms('elseif');
			},
			syn: 	{'sym':true,'sp':true},
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
				this.struct.atoms('else');
			},
			syn: 	{'ic':true,'sp':true},
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
			syn: 	{'ic':true,'sp':true}
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
					this.struct.append(new Horns.node.instruction(this.vars.instructionDetected == 'E', this));
				}
				this.struct.symbol(spl);
			},
			syn: 	{'ic':true,'icu':true,'sp':true},
		}// introduce allowed characters here
	};

	p.walk = function(i, cb)
	{
		for(var k = i; k < this.str.length; k++)
		{
			if(cb.apply(this, [k]) === false)
			{
				break;
			}
		}
	};
	p.detectAtom = function(i)
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

			found = this.atoms[all[k]].find.apply(this, [i]);
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
					atoms: false,
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
				atoms: 	all[k],
				val: 	found.inst,
				offs: 	found.offs
			};
		}
	}
	p.getStruct = function()
	{
		return this.struct;
	};
	p.buildStruct = function()
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
				if(next.atoms != false)
				{
					var detectedBefore = this.vars.instructionDetected;
					// do atoms action
					this.evalAtom(next, j);
					if(detectedBefore != false && next.atoms != 'sp')
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
	};
	p.get = function(obj)
	{
		return this.struct.tree.eval(obj);
	};
	p.registerHelper = function(name, cb)
	{
		if(typeof name == 'string' && name.length > 0 && typeof cb == 'function')
		{
			this.vars.helpers[name] = cb;
		}
	};
	p.isTxt = function(sw)
	{
		if(sw)
		{
			this.vars.ctxIns = false;
		}

		return !this.vars.ctxIns;
	};
	p.isInst = function(sw, escape)
	{
		if(sw)
		{
			this.vars.ctxIns = true;
			this.vars.instructionDetected = escape ? 'E' : 'N';
		}

		return this.vars.ctxIns;
	};
	p.evalAtom = function(found, j)
	{
		return this.atoms[found.atoms].do.apply(this, [found.val, j, found.offs]);
	};
	p.saveTextChunk = function()
	{
		if(this.vars.chunk != '')
		{
			this.struct.append(new Horns.node.static(this.vars.chunk));
			this.vars.chunk = '';
		}
	};
	p.appendChunk = function(i)
	{
		this.vars.chunk += this.str[i];
	};
	p.substr = function(i, str)
	{
		if(this.str.substr(i, str.length) == str)
		{
			return {
				offs: str.length,
				inst: str
			}
		}
		return false;
	};
	p.findSeq = function(i, expr)
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
	};
	p.isExpectable = function(atom, afterAtom)
	{
		if(afterAtom == null)
		{
			return true;
		}

		return typeof this.atoms[afterAtom].synR[atom] != 'undefined';
	};
	p.evalSymbol = function(sym, obj)
	{
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
	};
	p.callHelper = function(sym, obj)
	{
		var hName = '';
		var args = sym.args;

		if(sym.name == 'pseudo' && sym.args.length == 1)
		{
			// special case: test if argument is a function name
			var arg = sym.args[0];
			if(arg.length == 1 && typeof this.vars.helpers[arg[0]] != 'undefined')
			{
				hName = arg[0];
				args = [];
			}
			else
			{
				hName = 'pseudo';
			}
		}
		else
		{
			hName = sym.name;
		}

		if(typeof this.vars.helpers[hName] == 'undefined')
		{
			throw new Error('Unknown helper '+hName);
		}

		var hArgs = [];
		for(var k = 0; k < args.length; k++)
		{
			hArgs.push(this.evalSymbol(args[k], obj));
		}

		return this.vars.helpers[hName].apply(obj, hArgs);
	};

	// struct object

	Horns.Struct = function()
	{
		this.current = new Horns.node.instruction();
		this.tree = this.current;
	}
	Horns.Struct.prototype.forward = function(node)
	{
		this.append(node);
		this.current = node;
	}
	Horns.Struct.prototype.append = function(node)
	{
		node.parent = this.current;
		this.current.append(node);
	}
	Horns.Struct.prototype.backward = function()
	{
		this.current = this.current.parent;
	}
	Horns.Struct.prototype.symbol = function(sym)
	{
		this.current.get().symbol(sym);
	}
	Horns.Struct.prototype.get = function(){
		return this.current.get();
	}
	Horns.Struct.prototype.isCurrent = function(type)
	{
		if(type == 'instruction')
		{
			return this.current instanceof this.instruction;
		}

		return this.current instanceof node.instruction[type];
	}
	Horns.Struct.prototype.isExpectable = function(atom)
	{
		return this.current.isExpectable(atom);
	}
	Horns.Struct.prototype.atoms = function(atom)
	{
		return this.current.atoms(atom);
	}

	Horns.func = function(arg, name)
	{
		this.name = typeof name == 'undefined' ? 'pseudo' : name;
		this.args = [];

		if(typeof arg != 'undefined')
		{
			this.args.push(arg);
		}
	}
	Horns.func.prototype.addArg = function(symbol)
	{
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

	Horns.node = {};

	// text node
	Horns.node.static = function(val){
		this.value = val;
	}
	var nsp = Horns.node.static.prototype;
	nsp.eval = function(){
		return this.value;
	}
	nsp.append = function(){
	}
	nsp.symbol = function(){
	}
	nsp.get = function(i){
	}
	nsp.atoms = function(i){
	}

	// instruction node
	Horns.node.instruction = function(escape, parser){
		this.escape = !!escape;
		this.sym = null;
		this.ch = [];

		this.parser = parser;
	}
	var nip = Horns.node.instruction.prototype;
	nip.eval = function(obj)
	{
		// call function
		var value = '';

		if(this.sym !== null)
		{
			value = this.parser.callHelper(this.sym, obj);
		}

		// call sub instructions
		for(var k = 0; k < this.ch.length; k++)
		{
			value += this.ch[k].eval(obj);
		}

		return value;
	}
	nip.append = function(node){
		this.ch.push(node);
	}
	nip.symbol = function(symbol){
		if(this.sym == null)
		{
			this.sym = new Horns.func(symbol);
		}
		else
		{
			this.sym.addArg(symbol);
		}
	}
	nip.get = function(i){
		if(typeof i == 'undefined')
		{
			i = this.ch.length - 1;
		}
		return this.ch[i];
	}
	nip.atoms = function(i){
	}

	// if node
	Horns.node.instruction.ifelse = function(parser){
		this.branches = [];
		this.newBranch();
		this.metElse = false;

		this.parser = parser;
	}
	var niip = Horns.node.instruction.ifelse.prototype;
	niip.eval = function(obj)
	{
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
				res = this.parser.callHelper(br.cond, obj);
			}

			if(res)
			{
				var value = '';

				// call sub instructions
				for(var k = 0; k < br.ch.length; k++)
				{
					value += br.ch[k].eval(obj);
				}

				return value;
			}
		}
	}
	niip.append = function(node){
		this.getBranch().ch.push(node);
	}
	niip.symbol = function(symbol){

		// todo: check that no symbol can go after 'else' atoms

		var lastBr = this.getBranch();

		if(lastBr.cond == null)
		{
			lastBr.cond = new Horns.func(symbol);
		}
		else
		{
			lastBr.cond.addArg(symbol);
		}
	}
	niip.newBranch = function(){
		this.branches.push({
			cond: null,
			ch: []
		});
	}
	niip.getBranch = function(){
		return this.branches[this.branches.length - 1];
	}
	niip.get = function(i){
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
	niip.isExpectable = function(atom)
	{
		if(atom == 'endif')
		{
			return true;
		}
		return !this.metElse;
	}
	niip.atoms = function(atom){
		if(atom == 'elseif' || atom == 'else')
		{
			this.newBranch();
		}
		if(atom == 'else')
		{
			this.metElse = true;
		}
	}

})();