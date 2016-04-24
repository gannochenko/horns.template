<?

// todo: unite $ctx and $data into a single object, move dereferencePath() to that class (in js too)
// todo: add exportAtoms() to Node class

namespace
{
	use Horns\ParseException;

	class Horns
    {
        private $str =        '';
        private $struct =     null;
        private $tag =        false;
        private $at =         false;
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

        }

		public function get()
        {

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
    }
}

namespace Horns
{
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
		abstract public function evaluate();

		public function append()
		{
		}

		public function symbol()
		{
		}

		public function get($i)
		{
		}

		public function atoms($i)
		{
		}

		public function isExpectable()
		{
			return true;
		}
	}

    class Structure
    {

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
	// text node: 'Just some text'
	class Text extends \Horns\Node
	{
		private $value = '';

		public function __construct($value)
		{
			$this->value = $value;
		}

		public function evaluate()
		{
			return $this->value;
		}
	}
}