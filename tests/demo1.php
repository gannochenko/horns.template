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
</head>
<body>

	<?require("../src/php/horns.php");?>
	<?require("data/demo1.php");?>

	<header class="jumbotron">
		<div class="container">
			<div class="row row-header">
				<div class="col-xs-12">
					<h1>Welcome to Horns Template beta!</h1>
				</div>
			</div>
		</div>
	</header>

	<div class="container">
		<div class="row row-content">
			<div class="col-xs-12">
				<h2>Comments</h2>
			</div>
		</div>
	</div>

	<div class="container">
		<div class="row row-content">
			<div class="col-xs-12">
				<div class="media">
					<div class="media-left">
						<a href="#">
							<img class="media-object" src="..." alt="...">
						</a>
					</div>
					<div class="media-body">
						<h4 class="media-heading">Media heading</h4>
						...
					</div>
				</div>

				<?Horns::templateStart('comment');?>
					<blockquote>
						<p>{{text}}</p>
						<footer>{{author}}, date</footer>
					</blockquote>
				<?Horns::templateEnd();?>

			</div>
		</div>
		<div class="row row-content">
			<div class="btn-group" role="group" aria-label="pagination">
				<button type="button" class="btn btn-default">1</button>
				<button type="button" class="btn btn-default">2</button>
				<button type="button" class="btn btn-default">3</button>
			</div>
		</div>
	</div>
</body>
</html>