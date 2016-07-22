<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>European gothic</title>

	<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" integrity="sha384-1q8mTJOASx8j1Au+a5WDVnPi2lkFfwwEAa8hDDdjZlpLegxhjVME1fgjWPGmkzs7" crossorigin="anonymous">
	<script src="https://code.jquery.com/jquery-2.2.4.min.js" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script>
	<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/js/bootstrap.min.js" integrity="sha384-0mSbJDEHialfmuBBQP6A4Qrprq5OVfW37PRR3j5ELqxss1yVqOtnepnHVP9aJ7xS" crossorigin="anonymous"></script>

	<!--[if lt IE 9]>
	<script src="https://oss.maxcdn.com/html5shiv/3.7.2/html5shiv.min.js"></script>
	<script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
	<![endif]-->

	<script src="/src/js/horns.js?<?=rand(100, 999)?>"></script>
	<script src="/tests/demo/logic.js?<?=rand(100, 999)?>"></script>
	<link rel="stylesheet" href="/tests/demo/style.css" />
</head>
<body>

	<?require("../../src/php/horns.php");?>
	<?require("./assets/data.php");?>
	<?require("./helpersources.php");?>

	<?$currentId = array_key_exists('id', $_REQUEST) ? intval($_REQUEST['id']) : $data['product'][0]['id'];?>

	<header class="jumbotron">
		<div class="container">
			<div class="row row-header">
				<div class="col-xs-12">
					<h1>European gothic</h1>
				</div>
			</div>
		</div>
	</header>

	<div class="container main-container">

		<?Horns::templateStart('product_nav');?>
			<div class="row row-content image-nav">
				<div class="col-xs-12">
					<div class="btn-group" role="group" aria-label="pagination">
						{{#produceNavButtons this}}
							<button type="button" class="btn btn-default" data-id="{{imgId}}">{{num}}</button>
						{{/produceNavButtons}}
					</div>
				</div>
			</div>
		<?Horns::templateEnd($data['product']);?>

		<div class="image-here">
			<?Horns::templateStart('card');?>
				<div class="row row-content">
					<div class="col-xs-12 gallery">
						<div class="media">
							<div class="media-left">
								<img class="media-object" src="/tests/demo/assets/img/{{src}}" alt="{{name}}" />
							</div>
							<div class="media-body">
								<h2 class="media-heading">{{name}}</h2>
								<div>
									{{details}}
								</div>
							</div>
						</div>
						<div id="product-comments">
							{{#comments}}
								<?Horns::templateStart('comment');?>
									<blockquote>
										<p>{{text}}</p>
										<footer>{{author}}, {{convertTimeStamp date}}</footer>
									</blockquote>
								<?Horns::templateEnd();?>
							{{/comments}}
						</div>
					</div>
				</div>
			<?Horns::templateEnd(\HelperSource::getDataById($currentId, $data['product']));?>
		</div>

		<div class="row row-content">
			<div class="col-sm-6 col-xs-12">
				<form class="form-horizontal comment-form">
					<div class="form-group">
						<div class="col-sm-12">
							<input name="author" type="text" class="form-control" placeholder="Name" required="required">
						</div>
					</div>
					<div class="form-group">
						<div class="col-sm-12">
							<textarea name="text" class="form-control" placeholder="Comment text" required="required"></textarea>
						</div>
					</div>
					<div class="form-group">
						<div class="col-sm-12">
							<button type="submit" class="btn btn-default">Post comment</button>
						</div>
					</div>
				</form>
			</div>
		</div>

		<?=Horns::render('product_nav', $data['product']);?>

		<div id="same"></div>
	</div>

	<script>
		window.gc = new Application.GalleryController(<?=Horns::dataForward([
			'data' => $data,
			'current' => $currentId,
		])?>);
	</script>
</body>
</html>

