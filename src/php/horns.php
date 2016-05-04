<?
// todo: unite $ctx and $data into a single object, move dereferencePath() to that class (in js too)
// todo: add exportAtoms() to Node classes
// todo: rename methods atoms() to atom() ?

namespace
{
	use Horns\Exception;
	use Horns\Node\Text;
	use Horns\ParseException;
	use Horns\Structure;

	class Horns
    {
        private $str =        '';
        private $struct =     null;
        private $tag =        false;
        private $i =          0;
        private $chunk =      '';
        private $helpers =    [];

        private static $debugMode = false;
        private static $registry = [];

        public function __construct($str)
        {
            $this->str = $str;
            $this->registerHelper('pseudo', function($arg){return $arg;});
            $this->buildStruct();
        }
        
        public static function compile($str, $name = '')
        {
            $instance = new static($str);
            $name = trim((string) $name);

            if($name != '')
            {
                static::$registry[$name] = $instance;
            }

		    return $instance;
        }

		public static function registryGet($name)
		{
			return static::$registry[$name];
		}

		public function getCurrentParseOffset()
		{
			return $this->i;
		}

		public function getTemplateString()
		{
			return $this->str;
		}

		public function registerHelper($name, $cb)
		{
			$name = trim((string) $name);

			if($name != '' && is_callable($cb))
			{
				$this->helpers[$name] = $cb;
			}
		}

		public function callHelper($name, array $args, $ctx, $data)
		{
			if(!array_key_exists($name, $this->helpers))
			{
				return ''; // todo: or maybe null?
			}

			$hArgs = [];
			$argLen = count($args);
			for($k = 0; $k < $argLen; $k++)
			{
				array_push($hArgs, $args[$k].evaluate($ctx, $data));
			}

			// todo: somehow evaluate closure in php-way
			return '';
			//return this.parser.vars.helpers[this.name].apply(Util.dereferencePath(ctx, data), hArgs);
		}

	    private function showError($message)
		{
			throw new ParseException($message, $this);
		}

        private function buildStruct()
        {
	        $this->struct = new Structure($this);
	        $strLen = strlen($this->str);

	        if(strlen($this->str))
	        {
		        $i = 0;
		        $this->i = 0;
		        $next = null;
		        while(true)
		        {
			        if($this->i > $strLen - 1)
			        {
				        $this->saveTextChunk();
				        return $this->struct; // parse end
			        }

			        if($i >= $strLen)
			        {
				        throw new Exception('Endless loop detected');
			        }

			        $next = $this->detectAtom($this->i);
			        if($next['atom'] != false)
			        {
				        // do atoms action
				        $this->evaluateAtom($next);
				        $this->lastAtom($next); // save atom just found
			        }
			        else
			        {
				        if($this->inTag())
				        {
					        $this->appendChunk($this->i); // we are not inside of some Instruction, then append the symbol to the text chunk
				        }
			        }

			        $this->i += $next['offset'];
			        $i++;
		        }
	        }
        }

		public function get($obj)
        {
			return $this->struct->tree->evaluate([], $obj);
        }

	    private function inTag($change = false, $safe = false)
		{
			if($change)
			{
				if(static::$debugMode && !$change)
				{
					//console.dir('-------------------------------');
				}

				$this->tag = $change ? ['safe' => $safe, 'atoms' => []] : false;
			}
			else
			{
				return $this->tag !== false;
			}
		}

		private function evaluateAtom($found)
		{
			// todo: somehow eval the atom
			//return this.atoms[found.atom].do.apply(this, [found.value, this.vars.i, found.offset]);
		}

		private function saveTextChunk()
		{
			if($this->chunk != '')
			{
				$this->struct->append(new Text($this->chunk));
				$this->chunk = '';
			}
		}

		private function appendChunk($i)
		{
			$this->chunk += $this->str[$i];
		}

		// test if this.str has substring that equals to str at position i
		public function testSubString($i, $str)
		{
			if(substr($this->str, $i, strlen($str)) == $str)
			{
				return $str;
			}
			return false;
		}

		// test if a substring of this.str that starts from i matches a given regular expression. if match, return it
		public function testSequence($i, $expr)
		{
			$inst = false;
			$subStr = substr($this->str, $i, strlen($this->str) - $i);
			$r = [];
			if(preg_match('#^('.$expr.'+)#', $subStr, $r))
			{
				$inst = $r[1];
			}

			return $inst;
		}

		public function testKeyWord($i, $word)
		{
			return $this->testSequence($i, $word.'(\\s+|\}\}|\$)') ? $word : false;
		}

		public function isExpectable($found)
		{
			if(!$this->inTag())
			{
				return true;
			}
			else
			{
				$lastAtom = $this->lastAtom();
				if($lastAtom == null) // first atom in the tag
				{
					return true;
				}
				else
				{
					// todo: somehow implement this
					//return typeof this.atoms[lastAtom.atom].syn[found.atom] != 'undefined';
				}
			}

			return false;
		}

		private function lastAtom($found = null)
		{
			if($found != null)
			{
				if(!count($this->tag['atoms']))
				{
					return null;
				}

				return $this->tag['atoms'][count($this->tag['atoms']) - 1];
			}
			elseif($found !== null && $found !== false && $found['atom'] !== false)
			{
				if($this->tag === false) // we must be just left the tag
				{
					return null;
				}

				// spaces and brackets are useless, just skip
				if($found['atom'] != 'sp' && $found['atom'] != 'io' && $found['atom'] != 'ic' && $found['atom'] != 'iou' && $found['atom'] != 'icu')
				{
					$this->tag['atoms'][] = $found;
				}
			}
		}

		/*
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
		*/
    }
}

namespace Horns
{
	use Horns\Node\Instruction;

	class Symbol
	{
		private $parser = null;
		private $value = '';
		private $path = [];
		private $back = 0;

		public function getValue()
		{
			return $this->value;
		}

		public function __construct($value, \Horns $parser)
		{
			$this->parser = $parser;
			$this->value = trim((string) $value);

			$found = [];
			if(!preg_match('#^'.static::getRegExp().'#', $this->value, $found))
			{
				throw new Exception('Incorrect symbol passed: '.$this->value);
			}

			$this->path = array_pop($found); // get symbol name

			// calc count of "../"
			$valueLen = strlen($value);
			for($k = 0; $k < $valueLen;)
			{
				$sub = substr($value, $k, 3);
				$k += 3;
				if($sub == '../')
				{
					$this->back++;
				}
				else
				{
					break;
				}
			}

			// parse symbol sequence
			$this->path = $this->parseSeqence($this->path);
		}

		public function evaluate($ctx, $data)
		{
			$path = $this->absolutizePath($ctx);

			return Util::dereferencePath($path, $data);
		}

		public function isSimple()
		{
			return !$this->back && count($this->path) == 1;
		}

		private function absolutizePath($base)
		{
			$result = $base;

			// resolve "../" symbols relative to base
			if(count($result) && $this->back)
			{
				for($k = 0; $k < $this->back; $k++)
				{
					array_pop($result);
					if(!count($result))
					{
						break;
					}
				}
			}

			// attach symbol path
			$pLen = count($this->path);
			for($k = 0; $k < $pLen; $k++)
			{
				array_push($result, $this->path[$k]);
			}

			return $result;
		}

		private static function getRegExp()
		{
			return '(\.\./)*([a-zA-Z0-9_\\.]+)';
		}

		private function parseSeqence($sequence)
		{
			$sq = explode('.', (string) $sequence);
			$sqLen = count($sq);

			$offs = 0;
			for($k = 0; $k < $sqLen; $k++)
			{
				$sqKLen = strlen($sq[$k]);

				if(!$sqKLen)
				{
					throw new ParseException('Unexpected "." (dot)', $this->parser);
				}
				$offs += $sqKLen + 1;
			}

			return $sq;
		}
	}

	// helper call
	class FnCall
	{
		private $name = 'pseudo';
		private $args = [];
		private $parser = null;

		public function __construct(Symbol $arg, \Horns $parser)
		{
			$this->parser = $parser;

			if($arg)
			{
				array_push($this->args, $arg);
			}
		}

		public function addArgument(Symbol $arg)
		{
			if(count($this->args) == 1)
			{
				if(!$this->args[0]->isSimple())
				{
					throw new Exception('"'.$this->args[0]->getValue().'" is not a valid function name');
				}
				else
				{
					$this->name = $this->args[0]->getValue();
				}

				$this->args = [];
			}

			array_push($this->args, $arg);
		}

		public function evaluate($ctx, $data)
		{
			return $this->parser->callHelper($this->name, $this->args, $ctx, $data);
		}
	}

	abstract class Node
	{
		protected $parser = null;
		protected $parent = null;

		abstract public function evaluate($ctx, $data);

		public function setParent($parent)
		{
			$this->parent = $parent;
		}

		public function getParent()
		{
			return $this->parent;
		}

		public function append($node)
		{
		}

		public function symbol(\Horns\Symbol $symbol)
		{
		}

		public function get($i = false)
		{
		}

		public function atoms()
		{
			return null;
		}

		public function isExpectable()
		{
			return true;
		}

		public static function evaluateInstructionSet($iSet, $ctx, $data)
		{
			$value = '';
			$iSetLen = count($iSet);
			for($k = 0; $k < $iSetLen; $k++)
			{
				$value .= $iSet[$k]->evaluate($ctx, $data);
			}

			return $value;
		}
	}

    class Structure
    {
	    private $current = null;
	    private $tree = null;
	    private $parser = null;

	    public function __construct(\Horns $parser)
	    {
		    $this->current = new Instruction($parser);
		    $this->tree = $this->current;
		    $this->parser = $parser;
	    }

	    public function forward($node)
	    {
		    $this->append($node);
		    $this->current = $node;
	    }

	    public function append($node)
		{
			$node->setParent($this->current);
			$this->current->append($node);
		}

	    public function backward()
	    {
		    $this->current = $this->current->getParent();
	    }

	    public function symbol(Symbol $symbol)
		{
			$this->get()->symbol($symbol);
		}

	    public function get()
	    {
		    return $this->current->get();
	    }

	    public function isCurrent($type)
		{
			$className = '\\Horns\\Node\\Instruction\\'.$type;
			return $this->current instanceof $className;
		}

	    public function isExpectable($atom)
		{
			return $this->current->isExpectable($atom);
		}

	    public function atoms($atom)
		{
			return $this->current->atoms($atom);
		}
    }

	class Exception extends \Exception
	{
	}

	class ParseException extends Exception
	{
		public function __construct($message, \Horns $parser)
		{
			$i = $parser->getCurrentParseOffset() + 1;
			$str = $parser->getTemplateString();

			$message = trim((string) $message);

			$range = 30;
			$l = strlen($str);
			$leftRange = min($range, $i);
			$rightRange = $i + $range > $l ? $l - ($i + $range) : $range;

			$chunk = ($i > $range ? '...' : '').substr($str, $i - $leftRange, $leftRange).substr($str, $i, $rightRange).($i + $range < $l ? '...' : '');
			$cap = str_repeat(($i > $range ? '   ' : '').' ', $leftRange - 1).'^';

			$message = 'Parse error at '.$i.': '.$message.PHP_EOL.$chunk.PHP_EOL.$cap;

			parent::__construct($message);
		}
	}

	class Util
	{
		public static function dereferencePath(array $path, $data)
		{
			$val = $data;
			$pLen = count($path);
			for($k = 0; $k < $pLen; $k++)
			{
				$val = $val[$path[$k]];
				if(!$val)
				{
					return '';
				}
			}

			return $val;
		}
	}
}

namespace Horns\Node
{
	use Horns\FnCall;
	use Horns\Symbol;

	/**
	 * Class Node.Text
	 * Implements text node: 'Just some text between tags'
	 * @package Horns\Node
	 */
	class Text extends \Horns\Node
	{
		private $value = '';

		public function __construct($value)
		{
			$this->value = $value;
		}

		public function evaluate($ctx, $data)
		{
			return $this->value;
		}
	}

	/**
	 * Class Node.Instruction
	 * Implements instruction tag: {{varName}} or {{{varName}}}
	 * @package Horns\Node
	 */
	class Instruction extends \Horns\Node
	{
		private $escape = true;
		private $sym = null;
		private $sub = [];

		public function __construct(\Horns $parser, $escape = true)
		{
			$this->escape = !!$escape;
			$this->parser = $parser;
		}

		public function evaluate($ctx, $data)
		{
			$value = '';

			if($this->sym !== null)
			{
				$value = $this->sym->evaluate($ctx, $data);
			}

			$value .= static::evaluateInstructionSet($this->sub, $ctx, $data);

			return $value;
		}

		public function append($node)
		{
			$node[] = $this->sub;
		}

		public function symbol(Symbol $symbol)
		{
			if($this->sym == null)
			{
				$this->sym = new FnCall($symbol, $this->parser);
			}
			else
			{
				$this->sym->addArgument($symbol);
			}
		}

		public function get($i = false)
		{
			if ($i === false)
			{
				$i = count($this->sub) - 1;
			}
			return $this->sub[$i];
		}
	}
}

namespace Horns\Node\Instruction
{
	use Horns\ParseException;
	use Horns\FnCall;
	use Horns\Symbol;

	/**
	 * Class Node.Instruction.LogicLess
	 * Implements logic-less node: {{#inner}} {{...}} {{/inner}}
	 * @package Horns\Node\Instruction
	 */
	class LogicLess extends \Horns\Node\Instruction
	{
		private $sub = []; // sub-instruction set
		private $condition = null; // conditional function call, it always will be pseudo FnCall
		private $conditionalSymbol = false; // instruction symbol, i.e. when {{#inner}} met it will be "inner"

		public function evaluate($ctx, $data)
		{
			$value = '';
			if($this->condition === null)
			{
				return $value;
			}

			// calc logic less condition
			$result = $this->condition->evaluate($ctx, $data);
			// 1) iterable object or array. then instruction acts as each
			// 2) other stuff. then act as conditional operator, check if stuff is not falsie and enter\skip sub-instructions

			if($result)
			{
				$j = null;
				$resultKey = 'helper-result-'.floor(rand()*100);

				$iterable = is_array($result);
				if(!$iterable && is_object($result))
				{
					$iterable = in_array('Iterator', class_implements($result));
				}

				if($iterable) // array or object that supports iteration
				{
					$dRef = \Horns\Util::dereferencePath($ctx, $data);
					$dRef[$resultKey] = $result;
					array_push($resultKey, $ctx);

					foreach($result as $j => $val)
					{
						array_push($j, $ctx);
						$value .= static::evaluateInstructionSet($this->sub, $ctx, $data);
						array_pop($ctx);
					}

					array_pop($ctx);
					unset($dRef[$resultKey]);
				}
				elseif($result) // act as simple short conditional operator
				{
					$value .= static::evaluateInstructionSet($this->sub, $ctx, $data);
				}
			}

			return $value;
		}

		public function symbol(Symbol $symbol)
		{
			if($this->condition == null)
			{
				$this->conditionalSymbol = $symbol;
				$this->condition = new FnCall($symbol, $this->parser);
			}
			else
			{
				throw new ParseException('Unexpected symbol "'.$symbol->getValue().'"', $this->parser);
			}
		}

		public function isExpectable(Symbol $symbol)
		{
			return $this->conditionalSymbol->getValue() == $symbol->getValue(); // ensure that opening tag matches closing tag
		}

		public function get($i = false)
		{
			if(!count($this->sub))
			{
				return $this;
			}
			else
			{
				return $this->sub[count($this->sub) - 1];
			}
		}
	}

	/**
	 * Class Node.Instruction.NestedTemplate
	 * Implements nested template node: {{> templateName}}
	 * @package Horns\Node\Instruction
	 */
	class NestedTemplate extends \Horns\Node\Instruction
	{
		private $name = false;
		private $ctxSymbol = false;

		public function symbol(Symbol $symbol)
		{
			if($this->name === false)
			{
				$this->name = $symbol;
			}
			elseif($this->ctxSymbol === false)
			{
				$this->ctxSymbol = new FnCall($symbol, $this->parser);
			}
			else
			{
				throw new ParseException('Unexpected symbol "'.$symbol->getValue().'"', $this->parser);
			}
		}

		public function evaluate($ctx, $data)
		{
			$value = '';

			if($this->name !== false)
			{
				$template = \Horns::registryGet($this->name->getValue());
				if($template)
				{
					$rData = null;
					if($this->ctxSymbol !== false)
					{
						$rData = $this->ctxSymbol->evaluate($ctx, $data);
					}
					else
					{
						$rData = \Horns\Util::dereferencePath($ctx, $data);
					}

					$value = $template->get($rData);
				}
			}

			return $value;
		}

		public function get($i = false)
		{
			return $this;
		}
	}

	/**
	 * Class Node.Instruction.IfElse
	 * Implements conditional operator node:
	 *  {{#if smth}} ... {{else}} ... {{/if}} or {{if smth}} ... {{elseif anoter}} ... {{else}} ... {{endif}}
	 * @package Horns\Node\Instruction
	 */
	class IfElse extends \Horns\Node\Instruction
	{
		private $branches = [];
		private $metElse = false;

		public function __construct()
		{
			$this->newBranch();
		}

		private function newBranch()
		{
			$this->branches[] = [
				'cond' => null,
				'ch' => []
			];
		}

		public function evaluate($ctx, $data)
		{
			$value = '';
			$bLen = count($this->branches);

			for($k = 0; $k < $bLen; $k++)
			{
				$br = $this->branches[$k];
				$res = false;
				if($br['cond'] === null)
				{
					$res = true; // suppose it is 'else'
				}
				else
				{
					$res = $br['cond']->evaluate($ctx, $data);
				}

				if($res)
				{
					$value += static::evaluateInstructionSet($br['ch'], $ctx, $data);
					break;
				}
			}

			return $value;
		}

		public function append($node)
		{
			$this->branches[count($this->branches) - 1]['ch'][] = $node;
		}

		public function symbol(Symbol $symbol)
		{
			// todo: check that no symbol can go after 'else' atom

			$lastBr = $this->branches[count($this->branches) - 1];

			if($lastBr['cond'] == null)
			{
				$lastBr['cond'] = new FnCall($symbol, $this->parser);
			}
			else
			{
				$lastBr['cond']->addArgument($symbol);
			}
		}

		public function get($i)
		{
			$br = $this->branches[count($this->branches) - 1];
			if(!count($br['ch']))
			{
				return $this;
			}
			else
			{
				return $br['ch'][count($br['ch']) - 1];
			}
		}

		public function isExpectable(Symbol $symbol)
		{
			if($symbol->getValue() == 'endif')
			{
				return true;
			}
			return !$this->metElse;
		}

		public function atoms($atom)
		{
			if($atom == 'elseif' || $atom == 'else')
			{
				$this->newBranch();
			}
			if($atom == 'else')
			{
				$this->metElse = true;
			}
		}
	}
}