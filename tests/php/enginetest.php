<?
// to run: phpunit enginetest.php

include('../../src/php/horns.php');

class EngineTest extends PHPUnit_Framework_TestCase
{
	public function testA()
	{
		$template = 'The quick {{personA}} jumps over the lazy {{personB}}';
		$data = [
			'personA' => 'brown fox',
			'personB' => 'dog',
		];

		$parser = Horns::compile($template);

		//print_r($parser->get($data));

		$this->assertEquals(-1, -1);
	}

	/*
	public function testB()
	{
		$template = '<h3>Jumping around:</h3> {{#jumps}} {{> jumping}} <br /> {{/jumps}}';
		$data = [
			[
				'personA' => 'brown fox',
				'personB' => 'dog'
			],
			[
				'personA' => 'crazy elk',
				'personB' => 'brutal crocodile'
			],
			[
				'personA' => 'smelly squirrel',
				'personB' => 'gorgeous giraffe'
			]
		];

		$parser = new Horns($template);

		$this->assertEquals(-1, -1);
	}
	*/
}