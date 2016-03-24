(function(){

	Horns = function(str)
	{
		if(typeof str != 'string')
		{
			str = '';
		}

		this.str = str; // string to be parsed
		this.struct = new Horns.Struct(); // struct to be built, for further usages
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
	};
	Horns.compile = function(str)
	{
		return new Horns(str);
	};

	var p = Horns.prototype;
	p.atoms = {
		sp: {
			find: 	function(i){
				return this.testSequence(i, '\\s');
			},
			do: 	function(){},
			syn: 	{'if':true,'elseif':true,'else':true,'endif':true,'io':true,'iou':true,'ic':true,'icu':true,'sym':true}
		},
		iou: {
			find: 	function(i){
				return this.testSubString(i, '{{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.inTag(true, false);
			},
			syn: 	{'icu':true,'sym':true,'sp':true},
		},
		io: {
			find: 	function(i){
				return this.testSubString(i, '{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.inTag(true, true);
			},
			syn: 	{'hash':true,'slash':true,'if':true,'elseif':true,'else':true,'endif':true, 'ic':true, 'sym':true,'sp':true},
		},
		icu: {
			find: 	function(i){
				return this.testSubString(i, '}}}');
			},
			do: 	function()
			{
				if(this.vars.tag.safe) // entered to safe, exiting as unsafe?
				{
					this.showError('Unexpected "}}}"');
				}

				this.inTag(false); // going out of the instruction
			},
			syn: 	{'io':true,'iou':true,'sp':true},
		},
		// instruction close }}
		ic: {
			find: 	function(i){
				return this.testSubString(i, '}}');
			},
			do: 	function()
			{
				if(!this.vars.tag.safe) // entered to unsafe, exiting as safe?
				{
					this.showError('Unexpected "}}"');
				}

				this.inTag(false); // going out of the instruction
			},
			syn: 	{'io':true,'iou':true,'sp':true},
		},
		hash: {
			find: 	function(i){
				return this.testSubString(i, '#');
			},
			do: 	function(){

			},
			syn: 	{'if':true,'each':true,'sym':true,'sp':true},
		},
		slash: {
			find: 	function(i){
				return this.testSubString(i, '/');
			},
			do: 	function(){
			},
			syn: 	{'if':true,'each':true,'sym':true,'sp':true},
		},
		'if': {
			find: 	function(i){
				return this.testKeyWord(i, 'if');
			},
			do: 	function()
			{
				if(this.lastAtom().atom == 'slash')
				{
					this.atoms.endif.do.apply(this); // "\if" is treated as "endif"
				}
				else
				{
					this.struct.forward(new Horns.node.instruction.ifelse(this));
				}
			},
			syn: 	{'ic':true, 'sym':true,'sp':true},
		},
		'elseif': {
			find: 	function(i){
				return this.testKeyWord(i, 'elseif');
			},
			do: 	function(){
				if(!this.struct.isCurrent('ifelse') || !this.struct.isExpectable('elseif'))
				{
					this.showError('Unexpected "elseif"');
				}
				this.struct.atoms('elseif');
			},
			syn: 	{'sym':true,'sp':true},
		},
		'else': {
			find: 	function(i){
				return this.testKeyWord(i, 'else');
			},
			do: 	function(){
				if(!this.struct.isCurrent('ifelse') || !this.struct.isExpectable('else'))
				{
					this.showError('Unexpected "else"');
				}
				this.struct.atoms('else');
			},
			syn: 	{'ic':true,'sp':true},
		},
		endif: {
			find: 	function(i){
				return this.testKeyWord(i, 'endif');
			},
			do: 	function(){
				if(!this.struct.isCurrent('ifelse') || !this.struct.isExpectable('endif'))
				{
					this.showError('Unexpected "endif"');
				}
				this.struct.backward();
			},
			syn: 	{'ic':true,'sp':true}
		},

		// all other is SYMBOL. This rule must go at the end always
		sym: {
			find: 	function(i){
				return this.testSequence(i, '[a-zA-Z0-9_\\.]');
			},
			do: 	function(value, i){

				var spl = value.split('.');

				// parse symbol sequence
				var offs = 0;
				for(var k = 0; k < spl.length; k++)
				{
					if(spl[k].length == 0)
					{
						this.showError('Unexpected "." (dot)');
					}
					offs += spl[k].length + 1;
				}

				if(this.vars.tag != false)
				{
					console.dir('append?');

				}
				this.struct.symbol(spl);
			},
			syn: 	{'ic':true,'icu':true,'sym':true,'sp':true}
		}// introduce allowed characters here
	};
	p.atomList = []; // a list of atoms symbolic codes
	for(var k in p.atoms)
	{
		p.atomList.push(k);
	}

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
	p.lastAtom = function(found)
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

			if(found.atom != 'sp') // space is useless, just skip
			{
				this.vars.tag.atoms.push(found);
			}
		}
	};
	p.detectAtom = function(i)
	{
		var found = false;
		var all = this.inTag() ? this.atomList : ['iou', 'io'];

		for(var k = 0; k < all.length; k++)
		{
			if(all[k].length == 0)
			{
				continue;
			}

			//if(this.inTag())console.dir('check for '+all[k]);

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

			console.dir(result.offset+': '+result.atom+' ('+result.value+')');

			// check if it was expected
			if(!this.isExpectable(result))
			{
				this.showError('Unexpected "'+result.atom+'"');
			}
		}

		return result;
	};
	p.showError = function(message, i)
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
	p.getStruct = function()
	{
		return this.struct;
	};
	p.buildStruct = function()
	{
		if(this.str.length)
		{
			var i = 0;
			this.vars.i = 0;
			var next = null;
			while(true)
			{
				if(this.vars.i >= this.str.length - 1)
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
						this.appendChunk(this.vars.i); // we are not inside of some instruction, then append the symbol to the text chunk
					}
				}

				this.vars.i += next.offset;
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
	p.inTag = function(sw, safe)
	{
		if(typeof sw != 'undefined')
		{
			if(!sw)
			{
				console.dir('-------------------------------');
			}

			this.vars.tag = sw ? {safe: safe, atoms: []} : false;

			if(sw)
			{
				this.struct.append(new Horns.node.instruction(this.vars.tag.safe, this)); // add new instruction to the struct
			}
		}
		else
		{
			return this.vars.tag !== false;
		}
	};
	p.evalAtom = function(found)
	{
		return this.atoms[found.atom].do.apply(this, [found.value, this.vars.i, found.offset]);
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
	// test if this.str has substring that equal to str at position i
	p.testSubString = function(i, str)
	{
		if(this.str.substr(i, str.length) == str)
		{
			return str;
		}
		return false;
	};
	// test if a substring of this.str that starts from i matches a given regular expression. if match, return it
	p.testSequence = function(i, expr)
	{
		var expr = new RegExp('^('+expr+'+)');

		var inst = false;
		var r = this.str.substr(i, this.str.length - i).match(expr);
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
	p.testKeyWord = function(i, word)
	{
		return this.testSequence(i, word+'(\\s+|\}\}|\$)') ? word : false;
	};
	p.isExpectable = function(found)
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
			throw new ReferenceError('Unknown helper "'+hName+'"');
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
			return this.current instanceof Horns.node.instruction;
		}

		return this.current instanceof Horns.node.instruction[type];
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
				throw new ReferenceError('"'+this.args[0].join('.')+'" is not a valid function name');
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

}).call(this);