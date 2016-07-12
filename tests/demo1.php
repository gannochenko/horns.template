<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Sample catalog</title>

	<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" integrity="sha384-1q8mTJOASx8j1Au+a5WDVnPi2lkFfwwEAa8hDDdjZlpLegxhjVME1fgjWPGmkzs7" crossorigin="anonymous">
	<script src="https://code.jquery.com/jquery-2.2.4.min.js" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script>
	<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/js/bootstrap.min.js" integrity="sha384-0mSbJDEHialfmuBBQP6A4Qrprq5OVfW37PRR3j5ELqxss1yVqOtnepnHVP9aJ7xS" crossorigin="anonymous"></script>

	<!--[if lt IE 9]>
	<script src="https://oss.maxcdn.com/html5shiv/3.7.2/html5shiv.min.js"></script>
	<script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
	<![endif]-->

	<script src="/src/js/horns.js?<?=rand(100, 999)?>"></script>
	<script src="/tests/logic.js?<?=rand(100, 999)?>"></script>
	<link rel="stylesheet" href="/tests/style.css" />
</head>
<body>

	<?require("../src/php/horns.php");?>
	<?require("data/demo1.php");?>

	<header class="jumbotron">
		<div class="container">
			<div class="row row-header">
				<div class="col-xs-12">
					<h1>Amazing pictures</h1>
				</div>
			</div>
		</div>
	</header>

	<div class="container">
		<div class="row row-content">
			<div class="col-xs-12 gallery">

				<?//$time = microtime(true);?>

				<?Horns::templateStart();?>
					<div class="media">
						<div class="media-left">
							<a href="javascript:void(0)">
								<img class="media-object" src="/tests/data/img/{{src}}" alt="{{name}}" style="max-width: 300px">
							</a>
						</div>
						<div class="media-body">
							<h2 class="media-heading">{{name}}</h2>
							<div>
								{{details}}
							</div>
						</div>
					</div>
					<div>
						<?Horns::templateStart();?>
						{{#comments}}
						<blockquote>
							<p>{{text}}</p>
							<footer>{{author}}, {{formatDate date}}</footer>
						</blockquote>
						{{/comments}}
						<?Horns::templateEnd('comments', true);?>
					</div>
				<?Horns::templateEnd('product');?>

				<?=Horns::render('product', $data['product'][0]);?>

				<?//Horns::displayTime('full', $time);?>
			</div>
		</div>
		<div class="row row-content">
			<div class="col-xs-12">
				<div class="btn-group" role="group" aria-label="pagination">
					<button type="button" class="btn btn-default">1</button>
				</div>
			</div>
		</div>
	</div>

	<script>
		new Application.galleryController(<?=json_encode([
			'data' => $data,
		])?>);
	</script>
</body>
</html>