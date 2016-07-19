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
			$this->assertEquals(trim($test['result']), trim($parser->get($test['data'])), 'Test failed for '.$test['name']);
		}
	}
}