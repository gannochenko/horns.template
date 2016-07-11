<?
include "horns.php";
?>
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

<?
$helpers = array(

	'quote' => function($arg){
		return '&laquo;'.((string) $arg).'&raquo;';
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
);

//$template = 'The quick {{personA}} jumps over the lazy {{personB}}';
$template = '';
ob_start();
?>
<?/*
	The quick {{{quote personA}}} jumps over the lazy {{quote personB}}
*/?>

<?/*
	<h3>Jumping around:</h3> {{#jumps}} {{> jumping}} <br /> {{/jumps}}
*/?>

<form>
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
</form>

<?
$template = ob_get_clean();

/*
$data = [
	'personA' ' 'brown fox',
	'personB' ' 'dog',
];
*/
$data = [
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
];

\Horns::toggleDebugMode(false);
\Horns\Util::debug($template);

$parser = Horns::compile($template);

foreach($helpers as $name => $fn)
{
	$parser->registerHelper($name, $fn);
}

$parser->outputStructure();

print_r('----<br />');
print($parser->get($data));
print_r('<br />----<br />');
/*

	<h3>Dear {{guestName}}, your menu for today is:</h3>
	<ul>
	{{#meal}}
		<li>
			<b>{{ucFirst title}}</b><br />
			Time: {{time}}<br />
			Dishes: {{implode menu}}
		</li>
	{{/meal}}
	</ul>



 */