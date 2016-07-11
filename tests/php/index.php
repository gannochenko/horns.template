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
include "horns.php";

$helpers = array(

	'quote' => function($arg){
		return '&laquo;'.((string) $arg).'&raquo;';
	},
	'implodeArgs' => function(){
		return implode(', ', func_get_args());
	},
	'implode' => function($arg){
		return implode(', ', $arg);
	},
	'ucFirst' => function($arg){
		return ucfirst((string) $arg);
	},
	'totalPrice' => function($arg){

		$sum = 0;
		$len = count($arg);
		for($k = 0; $k < $len; $k++)
		{
			$element = $arg[$k];

			$sum += intval($element['price'])
					* intval($element['quantity'])
					* (array_key_exists('discount', $element) ? $element['discount'] : 1);
		}

		return $sum;
	},
	'isNotEmpty' => function($arg){
		return !empty($arg);
	},
	'getCost' => function($arg){

		if(!is_array($arg))
		{
			return 0;
		}

		return $arg['price'] * $arg['quantity'];
	},
	'getDiscountCost' => function($arg){

		if(!is_array($arg))
		{
			return 0;
		}

		$cost = $arg['price'] * $arg['quantity'];

		if(array_key_exists('discount', $arg))
		{
			$cost = floor($cost * $arg['discount']);
		}

		return $cost;
	},

	'isPistol' => function($weapon){
		return $weapon['type'] == 'P';
	},

	'isRifle' => function($weapon){
		return $weapon['type'] == 'R';
	},

	'isArmor' => function($weapon){
		return $weapon['type'] == 'A';
	},

	'getFactionName' => function($faction)
	{
		return $faction == 'CT' ? 'CT Forces' : 'Terrorists';
	}
);
$tests = array(
	array(
		'data' => [
			'personA' => 'brown fox',
			'personB' => 'dog',
		],
		'template' => 'The quick {{{quote personA}}} jumps over the lazy {{{quote personB}}}',
		'name' => 'jumping',
	),
	array(
		'data' => [
			'guestName' => 'Steve',
			'meal' => [
				[
					'title' => 'breakfast',
					'time' => '9:00 am',
					'menu' => ['Cup of coffee', 'Sandwich', 'Cigarette']
				],
				[
					'title' => 'dinner',
					'time' => '1:00 pm',
					'menu' => ['Vegetable salad', 'Mushroom soup', 'Cherry compote', 'Bread']
				],
				[
					'title' => 'supper',
					'time' => '6:00 pm',
					'menu' => ['Sausages with roasted potatoes', 'Cup of tea', 'Apple pie', 'Good movie to watch']
				]
			],
		],
		'template' => '<h3>Dear {{guestName}}, your menu for today is:</h3>
			<ul>
			{{#meal}}
				<li>
					<b>{{ucFirst title}}</b><br />
					Time: {{time}}<br />
					Dishes: {{implode menu}}
				</li>
			{{/meal}}
			</ul>',
		'name' => '',
	),
	array(
		'data' => [
			'basket'=> [
				[
					'name'=> 'Fish&Chips',
					'quantity'=> 3,
					'price'=> 10
				],
				[
					'name'=> 'Pair of socks',
					'quantity'=> 5,
					'price'=> 700
				],
				[
					'name'=> 'Microwave owen',
					'quantity'=> 1,
					'price'=> 1500
				],
				[
					'name'=> 'Mercedes 600',
					'quantity'=> 1,
					'price'=> 900000000,
					'discount'=> 0.03
				]
			],
			'payment'=> [
				['title'=> 'Visa/Master Card', 'value'=> 'card'],
				['title'=> 'Cash', 'value'=> 'cash', 'default'=> true]
			]
		],
		'template' => '<form>
				<h3>Your order is:</h3>
				<div class="container">
					{{#if isNotEmpty basket}}
						<table cellpadding="0" cellspacing="0">
							<thead><tr><th>Name</th><th>Price</th><th>Quantity</th><th>Cost</th></tr></thead>
							<tbody>
							{{#basket}}
							<tr>
								<td>{{name}}</td>
								<td>${{price}}</td>
								<td>{{quantity}}</td>
								<td>{{#if discount}}<s>{{/if}}${{getCost this}}{{#if discount}}</s> (with discount: ${{getDiscountCost this}}){{/if}}</td>
								</tr>
							{{/basket}}
							</tbody>
						</table>
					{{else}}
						<span class="red">Your basket is empty</span>
					{{/if}}
				</div>
				Total price: <span class="green">${{totalPrice basket}}</span><br /><br />
				Pay with:
				<select>
					{{#payment}}
					<option value="{{value}}" {{#if default}} selected="selected"{{/if}}>{{title}}</option>
					{{/payment}}
				</select>
			</form>',
		'name' => '',
	),
	array(
		'data' => [
			'basket'=> [
				[
					'name'=> 'Fish&Chips',
					'quantity'=> 3,
					'price'=> 10
				],
				[
					'name'=> 'Pair of socks',
					'quantity'=> 5,
					'price'=> 700
				],
			],
			'payment'=> [
				['title'=> 'Visa/Master Card', 'value'=> 'card'],
				['title'=> 'Cash', 'value'=> 'cash', 'default'=> true]
			]
		],
		'template' => '<la>{{getCostAlt basket.0 this}}</la>',
		'name' => '',
	),
	array(
		'data' => [
			'weapon' => [
				[
					'name' => 'Glock-17',
					'type' => 'P',
					'sides' => ['CT'],
					'inManual' => false
				],
				[
					'name' => 'MP-5',
					'type' => 'R',
					'sides' => ['CT', 'T'],
					'inManual' => true
				],
				[
					'name' => 'AK-47',
					'type' => 'R',
					'sides' => ['T']
				],
				[
					'name' => 'Kevlar',
					'type' => 'A',
					'sides' => ['CT', 'T'],
					'inManual' => true
				]
			],
		],
		'template' => '
			<h3>Counter-Strike 1.6 weapons:</h3>
			<ul>
			{{#weapon}}
			<li>{{name}}, type: {{#if isPistol this}}Pistol{{elseif isRifle this}}Rifle{{elseif isArmor this}}Armor{{else}}Unknown{{/if}}<br />
				Who can buy:<ul>
					{{#sides}}
					<li>{{getFactionName this}}{{#../../inManual}}&nbsp;&nbsp;<a href="#{{../../name}}">See game manual</a>{{/../../inManual}}</li>
					{{/sides}}
					</ul>
				</li>
			{{/weapon}}
			</ul>
			',
		'name' => '',
	),
	array(
		'data' => [
			'jumps' => [
				[
					'personA' => 'brown fox',
					'personB' => 'dog',
				],
				[
					'personA' => 'crazy elk',
					'personB' => 'brutal crocodile',
				],
				[
					'personA' => 'smelly squirrel',
					'personB' => 'gorgeous giraffe',
				]
			]
		],
		'template' => '<h3>Jumping around:</h3> {{#jumps}} {{> jumping}} <br /> {{/jumps}}',
		'name' => 'massive_jump',
	),
);

\Horns::toggleDebugMode(false);
\Horns::toggleProfileMode(true);
foreach($tests as $test)
{
	//\Horns\Util::debug($test['template']);
	$parser = Horns::compile($test['template'], $test['name']);

	foreach($helpers as $name => $fn)
	{
		$parser->registerHelper($name, $fn);
	}

	//$parser->outputStructure();
	print($parser->get($test['data']));
	print('<hr />');
}

?>

</body>
</html>
