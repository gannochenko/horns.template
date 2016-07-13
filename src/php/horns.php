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
	use Horns\Node\Instruction;
	use Horns\Util;

	class Horns
    {
		protected $str =        '';
		protected $struct =     null;
		protected $tag =        false; // todo: move to class, not array
		protected $i =          0;
		protected $chunk =      '';
		protected $helpers =    [];

        protected static $debugMode = false;
		protected static $profileMode = false;
		protected static $registry = [];
		protected static $instances = [];
		protected static $atomList = null;
		protected static $pageOutputBuffer = [];
		protected static $pageOutputDepth = 0;
		protected static $autoTranslation = true;
		protected static $translationPattern = '<script type="text/html" id="template-{{name}}">{{template}}</script>';

        public function __construct($str)
        {
            $this->str = $str;
            $this->registerHelper('pseudo', function($arg){return $arg;});
            $this->buildStruct();
        }

		public static function getAtoms()
		{
			if(static::$atomList === null)
			{
				static::$atomList =
					Instruction::exportAtoms() +
					Instruction\LogicLess::exportAtoms() +
					Instruction\NestedTemplate::exportAtoms() +
					Instruction\IfElse::exportAtoms() +
					array(
						// the last option: symbol, with allowed characters list
						'sym' => '\\Horns\\Atom\\Symbol',
					)
				;
			}

			return static::$atomList;
		}

        public static function compile($str, $name = '')
        {
	        $time = microtime(true);

            $instance = new static($str);
            $name = trim((string) $name);

            if($name != '')
            {
                static::$registry[$name] = $instance;
            }

	        if(static::$profileMode)
	        {
		        static::displayTime('Compile time: ', $time);
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

		/**
		 * @return \Horns\Structure
		 */
		public function getStructure()
		{
			return $this->struct;
		}

		public function getTag()
		{
			return $this->tag;
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
			if(!array_key_exists($name, $this->helpers) || !is_callable($this->helpers[$name]))
			{
				return ''; // todo: or maybe null?
			}

			$helper = $this->helpers[$name];
			$helperCtx =& Util::dereferencePath($ctx, $data);

			$hArgs = [];
			$argLen = count($args);
			for($k = 0; $k < $argLen; $k++)
			{
				$argValue = $args[$k]->getValue();
				if(trim($argValue) == 'this')
				{
					array_push($hArgs, $helperCtx);
				}
				else
				{
					array_push($hArgs, $args[$k]->evaluate($ctx, $data));
				}
			}

			$hArgs[] = $helperCtx; // append reference to helperCtx to the end of fn arguments

			if($helper instanceof Closure && is_object($helperCtx))
			{
				return $helper->call($helperCtx, $hArgs);
			}
			else
			{
				return call_user_func_array($helper, $hArgs);
			}
		}

	    public function showError($message)
		{
			throw new ParseException($message, $this);
		}

        private function buildStruct()
        {
	        $this->struct = new Structure($this);
	        $strLen = strlen($this->str);

	        if(strlen($this->str))
	        {
		        if(static::isInDebugMode())
		        {
			        Util::debug('>>> Atom sequence: ----------------------');
		        }

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
			        if($next['atom'])
			        {
				        // do atoms action
				        $this->evaluateAtom($next);
				        $this->lastAtom($next); // save atom just found

				        if(static::isInDebugMode())
				        {
							Util::debug($next['atom'].' => '.$next['value']);
				        }
			        }
			        else
			        {
				        if(!$this->inTag())
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
	        $time = microtime(true);

	        $data = $this->struct->tree->evaluate([], $obj);

	        if(static::$profileMode)
	        {
		        static::displayTime('Generate time: ', $time);
	        }

	        return $data;
        }

		public function inTag($change = null, $safe = false)
		{
			if($change !== null)
			{
				$this->tag = $change ? ['safe' => $safe, 'atoms' => []] : false;
			}
			else
			{
				return $this->tag !== false;
			}
		}

		private function evaluateAtom($found)
		{
			$atoms = $this->getAtoms();

			if($atoms[$found['atom']])
			{
				$className = $atoms[$found['atom']];
				return $className::append($found['value'], $this->i, $this);
			}

			return null;
		}

		public function saveTextChunk()
		{
			if($this->chunk != '')
			{
				if(static::isInDebugMode())
				{
					Util::debug($this->chunk);
				}

				$this->struct->append(new Text($this->chunk));
				$this->chunk = '';
			}
		}

		private function appendChunk($i)
		{
			$this->chunk .= $this->str[$i];
		}

		public function isExpectable(array $found)
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
					$atoms = $this->getAtoms();
					if($atoms[$lastAtom['atom']]) // getNextPossible
					{
						$atomClass = $atoms[$lastAtom['atom']];
						$possible = $atomClass::getNextPossible();

						return array_key_exists($found['atom'], $possible);
					}
				}
			}

			return false;
		}

		public function lastAtom($found = null)
		{
			if($found === null)
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

		public function detectAtom($i)
		{
			$found = false;
			$atomMap = $this->getAtoms();
			$all = $this->inTag() ? array_keys($atomMap) : ['iou', 'io'];
			$cntAll = count($all);

			for($k = 0; $k < $cntAll; $k++)
			{
				if(!count($all[$k]))
				{
					continue;
				}

				$atomClass = $atomMap[$all[$k]];

				$found = $atomClass::find($i, $this);
				if($found !== false)
				{
					break;
				}
			}

			// todo: object is required here
			$result = array(
				'atom' => false, // no atoms found
				'value' => null,
				'offset' => 1 // increase offset by 1
			);

			if($found === false) // nothing were found
			{
				if($this->inTag())
				{
					$this->showError('Unexpected "'.$this->getTemplateString()[$i].'"'); // nowhere to go
				}
			}
			else
			{
				$result = array(
					'atom' => 	$all[$k],
					'value' => 	$found,
					'offset' => strlen($found) // increase offset by atom value length
				);

				/*
				if(Horns.debugMode)
				{
					console.dir(result.offset+': '+result.atom+' ('+result.value+')');
				}
				*/

				// check if it was expected
				if(!$this->isExpectable($result))
				{
					$this->showError('Unexpected "'.$result['value'].'"');
				}
			}

			return $result;
		}

		// methods for debugging purposes

		public function outputStructure()
		{
			$this->struct->debugOutput();
		}

		public static function toggleProfileMode($flag)
		{
			static::$profileMode = !!$flag;
		}

		public static function toggleDebugMode($flag)
		{
			static::$debugMode = !!$flag;
		}

		public static function isInDebugMode()
		{
			return static::$debugMode;
		}

		public static function displayTime($label, $start)
		{
			$amount = microtime(true) - $start;
			Util::debug($label.' '.round($amount / 60, 7).' sec');
		}

		// methods for in-page purposes

		public static function toggleAutoTranslation($flag)
		{
			static::$autoTranslation = !!$flag;
		}

		public static function setTranslationPattern($pattern)
		{
			static::$translationPattern = $pattern;
		}

		public static function templateStart()
		{
			static::$pageOutputDepth += 1;
			ob_start();
		}

		public static function templateEnd($name = '', $renderData = null)
		{
			$name = (string) $name;

			$instance = static::compile(ob_get_clean(), $name);

			// tmp
			$instance->registerHelper('produceButtons', function(){
				return [['num' => 1], ['num' => 2], ['num' => 3]];
			});

			if($name != '')
			{
				static::$instances[$name] = $instance;
				static::$pageOutputBuffer[$name] = $instance->getTemplateString();

				if(static::$pageOutputDepth > 1) // we are inside of the other template, we suppose to make nesting
				{
					print('{{> '.$name.'}}');
				}
			}

			static::$pageOutputDepth -= 1;

			if(!static::$pageOutputDepth && static::$autoTranslation)
			{
				// translate templates into js from translation buffer
				foreach(static::$pageOutputBuffer as $name => $template)
				{
					print(str_replace(array(
						'{{name}}', '{{template}}'
					), array(
						$name, $template
					),
					static::$translationPattern));
				}

				static::$pageOutputBuffer = [];

				if($name != '' && $renderData)
				{
					print(static::render($name, $renderData));
				}
			}


			return $instance;
		}

		public static function render($name, $data)
		{
			return static::$instances[$name]->get($data);
		}

		public static function export()
		{
			$result = array();
			foreach(static::$instances as $name => $instance)
			{
				$result[$name] = $instance->getTemplateString();
			}

			return $result;
		}
    }
}

namespace Horns
{
	use Horns\Node\Instruction;

	abstract class Atom
	{
		public static function find($i, \Horns $parser)
		{
			return '';
		}

		public static function append($value, $i, \Horns $parser)
		{
		}

		/**
		 * Return a list of allowed following atoms
		 */
		public static function getNextPossible()
		{
			return array();
		}
	}

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

		public function evaluate($ctx, &$data)
		{
			$path = $this->absolutizePath($ctx);

			return Util::dereferencePath($path, $data);
		}

		public function isSimple()
		{
			return !$this->back && count($this->path) == 1;
		}

		public static function getRegExp()
		{
			return '(\.\./)*([a-zA-Z0-9_\\.]+)';
		}

		public function getBriefDebug()
		{
			return str_repeat('../', $this->back).implode('.', $this->path);
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
		protected $nameReplaced = false;

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
			if(!$this->nameReplaced)
			{
				if(!$this->args[0]->isSimple())
				{
					throw new Exception('"'.$this->args[0]->getValue().'" is not a valid function name');
				}
				else
				{
					$this->name = $this->args[0]->getValue();
				}

				$this->nameReplaced = true;
				$this->args = [];
			}

			array_push($this->args, $arg);
		}

		public function evaluate($ctx, &$data)
		{
			return $this->parser->callHelper($this->name, $this->args, $ctx, $data);
		}

		public function getBriefDebug()
		{
			return $this->name.'('.implode(', ', array_map(function($item){
				return $item->getBriefDebug();
			}, $this->args)).')';
		}
	}

	abstract class Node
	{
		protected $parser = null;
		protected $parent = null;
		protected $sub = [];

		abstract public function evaluate($ctx, &$data);

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

		public function isExpectable($symbol)
		{
			return true;
		}

		public static function evaluateInstructionSet($iSet, $ctx, &$data)
		{
			$value = '';
			$iSetLen = count($iSet);
			for($k = 0; $k < $iSetLen; $k++)
			{
				$value .= $iSet[$k]->evaluate($ctx, $data);
			}

			return $value;
		}

		public static function exportAtoms()
		{
			return array();
		}

		public function debugOutput()
		{
			print('<div style="margin-left: 40px">');
			Util::debug(get_called_class().': '.$this->getBriefDebug());
			$this->debugOutputSelf();
			$this->debugOutputSub();
			print('</div>');
		}

		public function getBriefDebug()
		{
			return '';
		}

		public function debugOutputSelf()
		{
		}

		public function debugOutputSub()
		{
			foreach($this->sub as $k => $instruction)
			{
				$instruction->debugOutput();
			}
		}
	}

    class Structure
    {
	    private $current = null;
	    public $tree = null; // todo: this property should not be public
	    private $parser = null;

	    public function __construct(\Horns $parser)
	    {
		    $this->current = new Instruction($parser, false);
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

	    public function isExpectable($symbol)
		{
			return $this->current->isExpectable($symbol); // instruction->isExpectable
		}

	    public function atoms($atom)
		{
			return $this->current->atoms($atom);
		}

	    public function debugOutput()
	    {
		    $this->tree->debugOutput();
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
		public static function &dereferencePath(array $path, &$data)
		{
			$val =& $data;
			$pLen = count($path);
			for($k = 0; $k < $pLen; $k++)
			{
				if(!is_array($val) || !array_key_exists($path[$k], $val))
				{
					$noValue = '';
					return $noValue;
				}

				$val =& $val[$path[$k]];
			}

			return $val;
		}

		// test if this.str has substring that equals to str at position i
		public static function testSubString($hayStack, $i, $str)
		{
			if(substr($hayStack, $i, strlen($str)) == $str)
			{
				return $str;
			}
			return false;
		}

		// test if a substring of this.str that starts from i matches a given regular expression. if match, return it
		public static function testSequence($hayStack, $i, $expr)
		{
			$inst = false;
			$subStr = substr($hayStack, $i, strlen($hayStack) - $i);
			$r = [];
			if(preg_match('#^('.$expr.'+)#', $subStr, $r))
			{
				$inst = $r[1];
			}

			return $inst;
		}

		public static function testKeyWord($hayStack, $i, $word)
		{
			return static::testSequence($hayStack, $i, $word.'(\\s+|\}\}|\$)') ? $word : false;
		}

		public static function debug($data)
		{
			print('<pre>');print_r(is_string($data) ? htmlspecialchars($data) : $data);print('</pre>');
		}
	}
}

namespace Horns\Node
{
	use Horns\FnCall;
	use Horns\Symbol;
	use Horns\Util;

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

		public function evaluate($ctx, &$data)
		{
			return $this->value;
		}

		public function debugOutputSub()
		{
			Util::debug($this->value);
		}
	}

	/**
	 * Class Node.Instruction
	 * Implements a single-tag instruction: {{varName}} or {{{varName}}}
	 * @package Horns\Node
	 */
	class Instruction extends \Horns\Node
	{
		protected $escape = true;
		protected $sym = null;

		public function __construct(\Horns $parser, $escape = true)
		{
			$this->escape = !!$escape;
			$this->parser = $parser;
		}

		public function evaluate($ctx, &$data)
		{
			$value = '';

			if($this->sym !== null)
			{
				$value = $this->sym->evaluate($ctx, $data);
			}

			$value .= static::evaluateInstructionSet($this->sub, $ctx, $data);

			return $this->escape ? htmlspecialchars($value) : $value;
		}

		public function append($node)
		{
			$this->sub[] = $node;
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

		public static function exportAtoms()
		{
			// do not reorder
			return array(
				'sp' => '\\Horns\\Atom\\Space',
				'iou' => '\\Horns\\Atom\\TagOpenUnsafe',
				'io' => '\\Horns\\Atom\\TagOpen',
				'icu' => '\\Horns\\Atom\\TagCloseUnsafe',
				'ic' => '\\Horns\\Atom\\TagClose',
				'hash' => '\\Horns\\Atom\\Hash',
				'slash' => '\\Horns\\Atom\\Slash',
			);
		}

		public function getBriefDebug()
		{
			return ($this->escape ? 'S' : 'Uns').'afe'.($this->sym ? ', fn:'.$this->sym->getBriefDebug() : '');
		}
	}
}

namespace Horns\Node\Instruction
{
	use Horns\ParseException;
	use Horns\FnCall;
	use Horns\Symbol;
	use Horns\Node\Instruction;
	use Horns\Util;

	/**
	 * Class Node.Instruction.LogicLess
	 * Implements logic-less node: {{#inner}} {{...}} {{/inner}}
	 * @package Horns\Node\Instruction
	 */
	class LogicLess extends Instruction
	{
		// todo: $condition and parent::$sym have the same meaning, so leave one of them, remove the other
		protected $condition = null; // conditional function call, it always will be pseudo FnCall
		// todo: replace use of $conditionalSymbol with smth like $condition->getArgument(0)
		protected $conditionalSymbol = false; // instruction symbol, i.e. when {{#inner}} met it will be "inner"

		public function evaluate($ctx, &$data)
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
					$dRef =& \Horns\Util::dereferencePath($ctx, $data);
					if(!is_array($dRef))
					{
						return '';
					}

					$dRef[$resultKey] = $result;
					array_push($ctx, $resultKey);

					foreach($result as $j => $val)
					{
						array_push($ctx, $j);
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
				$this->condition->addArgument($symbol);
			}
		}

		public function isExpectable($symbol)
		{
			$value = $symbol instanceof Symbol ? $symbol->getValue() : (string) $symbol;

			return $this->conditionalSymbol->getValue() == $value; // ensure that opening tag matches closing tag
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

		public function getBriefDebug()
		{
			return ($this->condition ? 'fn:'.$this->condition->getBriefDebug() : '');
		}
	}

	/**
	 * Class Node.Instruction.NestedTemplate
	 * Implements nested template node: {{> templateName}}
	 * @package Horns\Node\Instruction
	 */
	class NestedTemplate extends Instruction
	{
		protected $name = false;
		// todo: $ctxSymbol and parent::$sym have the same meaning, so leave one of them, remove the other
		protected $ctxSymbol = false;

		public function symbol(Symbol $symbol)
		{
			if ($this->name === false)
			{
				$this->name = $symbol;
			}
			elseif($this->ctxSymbol === false)
			{
				$this->ctxSymbol = new FnCall($symbol, $this->parser);
			}
			else
			{
				throw new ParseException('Unexpected symbol "' . $symbol->getValue() . '"', $this->parser);
			}
		}

		public function evaluate($ctx, &$data)
		{
			$value = '';

			if ($this->name !== false)
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
						$rData = Util::dereferencePath($ctx, $data);
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

		public static function exportAtoms()
		{
			return array(
				'nested' => '\\Horns\\Atom\\TemplateInclude',
			);
		}

		public function getBriefDebug()
		{
			return $this->name->getBriefDebug().' '.($this->ctxSymbol ? 'fn:'.$this->ctxSymbol->getBriefDebug() : '');
		}
	}

	/**
	 * Class Node.Instruction.IfElse
	 * Implements conditional operator node:
	 *  {{#if smth}} ... {{else}} ... {{/if}} or {{if smth}} ... {{elseif anoter}} ... {{else}} ... {{endif}}
	 * @package Horns\Node\Instruction
	 */
	class IfElse extends Instruction // todo: rename IfElse to Conditional
	{
		protected $branches = [];
		protected $metElse = false;

		public function __construct(\Horns $parser)
		{
			parent::__construct($parser, false);

			$this->newBranch();
		}

		private function newBranch()
		{
			$this->branches[] = [
				'cond' => null,
				'ch' => [], // todo: rename to sub?
			];
		}

		public function evaluate($ctx, &$data)
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
					$value .= static::evaluateInstructionSet($br['ch'], $ctx, $data);
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
			$lastBr =& $this->branches[count($this->branches) - 1];

			if($lastBr['cond'] == null)
			{
				$lastBr['cond'] = new FnCall($symbol, $this->parser);
			}
			else
			{
				$lastBr['cond']->addArgument($symbol);
			}
		}

		public function get($i = false)
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

		public function isExpectable($symbol)
		{
			$value = $symbol instanceof Symbol ? $symbol->getValue() : (string) $symbol;

			if($value == 'endif')
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

		public static function exportAtoms()
		{
			return array(
				'if' => '\\Horns\\Atom\\If_',
				'elseif' => '\\Horns\\Atom\\ElseIf_',
				'else' => '\\Horns\\Atom\\Else_',
				'endif' => '\\Horns\\Atom\\EndIf_',
			);
		}

		public function getBriefDebug()
		{
			return $this->metElse ? 'Full' : 'Short';
		}

		public function debugOutputSelf()
		{
			foreach($this->branches as $k => $branch)
			{
				Util::debug('Branch #'.$k.' '.($branch['cond'] ? $branch['cond']->getBriefDebug() : ''));
				foreach($branch['ch'] as $sub)
				{
					$sub->debugOutput();
				}
			}
		}
	}
}

namespace Horns\Atom
{
	use Horns\Util;
	use Horns\Node\Instruction;
	use Horns\Atom;

	final class Symbol extends Atom
	{
		public static function find($i, \Horns $parser)
		{
			return Util::testSequence($parser->getTemplateString(), $i, \Horns\Symbol::getRegExp());
		}

		public static function append($value, $i, \Horns $parser)
		{
			$spl = new \Horns\Symbol($value, $parser);

			if($parser->lastAtom() === null)
			{
				$tag = $parser->getTag();

				$node = new Instruction($parser, $tag['safe']);

				$parser->getStructure()->append($node); // add new Instruction to the struct
				$parser->getStructure()->symbol($spl); // todo: just $node->symbol($spl) ?
			}
			else
			{
				$lastAtom = $parser->lastAtom();
				if($lastAtom['atom'] == 'hash')
				{
					$node = new Instruction\LogicLess($parser, false);
					$node->symbol($spl);

					$parser->getStructure()->forward($node);
				}
				elseif($lastAtom['atom'] == 'slash')
				{
					if(!$parser->getStructure()->isExpectable($spl))
					{
						$parser->showError('Unexpected "'.$value.'"');
					}
					$parser->getStructure()->backward();
				}
				else
				{
					$parser->getStructure()->symbol($spl);
				}
			}
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array('ic' => true, 'icu' => true, 'sym' => true, 'sp' => true);
		}
	}

	final class Space extends Atom
	{
		public static function find($i, \Horns $parser)
		{
			return Util::testSequence($parser->getTemplateString(), $i, '\\s');
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'if' => true, 'elseif' => true, 'else' => true, 'endif' => true,
				'io' => true, 'iou' => true, 'ic' => true, 'icu' => true, 'sym' => true
			);
		}
	}

	abstract class Constant extends Atom
	{
		public static function getSequence()
		{
			return '';
		}

		public static function find($i, \Horns $parser)
		{
			return Util::testSubString($parser->getTemplateString(), $i, static::getSequence());
		}
	}

	final class TagOpen extends Constant
	{
		public static function getSequence()
		{
			return '{{';
		}

		public static function append($value, $i, \Horns $parser)
		{
			$parser->saveTextChunk(); // todo: move this inside inTag()
			$parser->inTag(true, true);
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'hash' => true, 'slash' => true, 'nested' => true, 'if' => true, 'elseif' => true, 'else' => true,
				'endif' => true, 'ic' => true, 'sym' => true, 'sp' => true,
			);
		}
	}

	final class TagClose extends Constant
	{
		public static function getSequence()
		{
			return '}}';
		}

		public static function append($value, $i, \Horns $parser)
		{
			$tag = $parser->getTag();

			if(!$tag['safe']) // entered to unsafe, exiting as safe?
			{
				$parser->showError('Unexpected "'.static::getSequence().'"');
			}

			$parser->inTag(false); // going out of the Instruction
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'io' => true, 'iou' => true, 'sp' => true,
			);
		}
	}

	final class TagOpenUnsafe extends Constant
	{
		public static function getSequence()
		{
			return '{{{';
		}

		public static function append($value, $i, \Horns $parser)
		{
			$parser->saveTextChunk(); // todo: move this inside inTag()
			$parser->inTag(true, false);
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'icu' => true, 'sym' => true, 'sp' => true
			);
		}
	}

	final class TagCloseUnsafe extends Constant
	{
		public static function getSequence()
		{
			return '}}}';
		}

		public static function append($value, $i, \Horns $parser)
		{
			$tag = $parser->getTag();

			if($tag['safe']) // entered to safe, exiting as unsafe?
			{
				$parser->showError('Unexpected "'.static::getSequence().'"');
			}

			$parser->inTag(false); // going out of the Instruction
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'io' => true, 'iou' => true, 'sp' => true,
			);
		}
	}

	final class Hash extends Constant
	{
		public static function getSequence()
		{
			return '#';
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'if' => true, 'each' => true, 'sym' => true, 'sp' => true
			);
		}
	}

	final class Slash extends Constant
	{
		public static function getSequence()
		{
			return '/';
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'if' => true, 'each' => true, 'sym' => true, 'sp' => true
			);
		}
	}

	final class TemplateInclude extends Constant
	{
		public static function getSequence()
		{
			return '>';
		}

		public static function append($value, $i, \Horns $parser)
		{
			$parser->getStructure()->append(new Instruction\NestedTemplate($parser));
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'sym' => true, 'sp' => true
			);
		}
	}
	
	final class If_ extends Constant
	{
		public static function getSequence()
		{
			return 'if';
		}

		public static function append($value, $i, \Horns $parser)
		{
			$lastAtom = $parser->lastAtom();

			if($lastAtom !== null && $lastAtom['atom'] == 'slash')
			{
				EndIf_::append($value, $i, $parser); // "\if" is treated as "endif"
			}
			else
			{
				$parser->getStructure()->forward(new Instruction\IfElse($parser));
			}
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'ic' => true, 'sym' => true,  'sp' => true
			);
		}
	}

	final class EndIf_ extends Constant
	{
		public static function getSequence()
		{
			return 'endif';
		}

		public static function append($value, $i, \Horns $parser)
		{
			if(!$parser->getStructure()->isCurrent('IfElse') || !$parser->getStructure()->isExpectable('endif'))
			{
				$parser->showError('Unexpected "endif"');
			}
			$parser->getStructure()->backward();
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'ic' => true, 'sp' => true
			);
		}
	}

	final class ElseIf_ extends Constant
	{
		public static function getSequence()
		{
			return 'elseif';
		}

		public static function append($value, $i, \Horns $parser)
		{
			$structure = $parser->getStructure();

			$currentIsIfElse = $structure->isCurrent('IfElse');
			$elseifExpectable = $structure->isExpectable('elseif');

			if(!$currentIsIfElse || !$elseifExpectable)
			{
				$parser->showError('Unexpected "elseif"');
			}
			$parser->getStructure()->atoms('elseif');
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'sym' => true, 'sp' => true
			);
		}
	}

	final class Else_ extends Constant
	{
		public static function getSequence()
		{
			return 'else';
		}

		public static function append($value, $i, \Horns $parser)
		{
			if(!$parser->getStructure()->isCurrent('IfElse') || !$parser->getStructure()->isExpectable('else'))
			{
				$parser->showError('Unexpected "else"');
			}
			$parser->getStructure()->atoms('else');
		}

		public static function getNextPossible()
		{
			// todo: replace atom codes with their class names, i.e. "sym" with "\Horns\Atom\Symbol"
			return array(
				'ic' => true, 'sp' => true
			);
		}
	}
}