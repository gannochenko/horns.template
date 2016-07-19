<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Horns tests</title>
</head>
<body>

	<style>
		.green{
			color: green;
		}
		.red {
			color: red;
		}
		.container {
			margin: 10px 0;
		}
		td, th {
			padding: 10px 5px;
		}
		tr th {
			border-bottom: 1px solid gray;
		}
		tbody tr:nth-child(even){
			background-color: #ececef;
		}
	</style>

	<h1>Horns test page: PHP</h1>

<?
include('../../src/php/horns.php');
include('tests.php');

\Horns::toggleDebugMode(false);
\Horns::toggleProfileMode(true);
\Horns::registerGlobalHelpers(Tests::getHelpers());
foreach(Tests::getAll() as $test)
{
	//\Horns\Util::debug($test['template']);
	$parser = Horns::compile($test['template'], $test['name']);

	//$parser->outputStructure();
	print('<pre>');print(htmlspecialchars($parser->get($test['data'])));print('</pre>');
	//print($parser->get($test['data']));
	print('<hr />');
}

?>

</body>
</html>
