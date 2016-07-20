<?
// to run: phpunit phpunit.php

include('../../src/php/horns.php');
include('tests.php');

/*
	\Horns::toggleDebugMode(false);
	\Horns::toggleProfileMode(true);
*/

class MainTest extends PHPUnit_Framework_TestCase
{
	public function testCompileGet()
	{
		$tests = Tests::getAll();
		Horns::registerGlobalHelpers(Tests::getHelpers());

		foreach($tests as $test)
		{
			$parser = Horns::compile($test['template'], $test['name']);
			$this->assertSameNoWhitespace(trim($test['result']), trim($parser->get($test['data'])), 'Test failed for '.$test['name']);
		}
	}

	public static function assertSameNoWhitespace($expected, $actual, $message = '')
	{
		self::assertThat($actual, new PHPUnit_Framework_Constraint_SameAsNoWhitespace(
			$expected
		), $message);
	}
}

class PHPUnit_Framework_Constraint_SameAsNoWhitespace extends \PHPUnit_Framework_Constraint
{
	private $expected = '';

	public function __construct($expected)
	{
		$this->expected = $expected;

		parent::__construct();
	}

	public function matches($other)
	{
		return preg_replace('#\s#', '', (string) $other) == preg_replace('#\s#', '', $this->expected);
	}

	public function toString()
	{
		return ' equals to '.$this->expected;
	}
}