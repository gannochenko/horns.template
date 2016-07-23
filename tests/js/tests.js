'use strict';

window.Tests = {
	getHelpers: function()
	{
		return {
			quote: function(arg){
				return '&laquo;'+arg+'&raquo;';
			},
			implodeArgs: function(){
				return Array.prototype.slice.call(arguments).join(', ');
			},
			implode: function(arg){
				return arg.join(', ');
			},
			ucFirst: function(arg){
				arg = arg.toString();
				return arg.substr(0, 1).toUpperCase()+arg.substr(1);
			},
			totalPrice: function(arg){
				var sum = 0;
				for(var k = 0; k < arg.length; k++)
				{
					sum += parseInt(arg[k].price) * parseInt(arg[k].quantity) * (arg[k].discount ? arg[k].discount : 1);
				}
				return sum;
			},
			isNotEmpty: function(arg){
				return arg.length > 0;
			},
			getCost: function(arg1, arg2){
				return this.price * this.quantity;
			},
			getCostAlt: function(arg1, arg2){
				return (arg1.price * arg1.quantity) + ' of ' + arg2.payment[1].title;
			},
			getDiscountCost: function(){
				var cost = this.price * this.quantity;

				if(this.discount)
				{
					cost = Math.floor(cost * this.discount);
				}

				return cost;
			},
			isPistol: function(){
				return this.type == 'P';
			},
			isRifle: function(){
				return this.type == 'R';
			},
			isArmor: function(){
				return this.type == 'A';
			},
			getFactionName: function()
			{
				return this == 'CT' ? 'CT Forces' : 'Terrorists';
			}
		};
	},

	getAll: function()
	{
		return [
			{
				data: {
					personA: 'brown fox',
					personB: 'dog'
				},
				template: 'The quick {{{quote personA}}} jumps over the lazy {{{quote personB}}}',
				name: 'jumping',
				result: 'The quick &laquo;brown fox&raquo; jumps over the lazy &laquo;dog&raquo;'
			},
			{
				data: {
					guestName: 'Steve',
					meal: [
						{
							title: 'breakfast',
							time: '9:00 am',
							menu: ['Cup of coffee', 'Sandwich', 'Cigarette']
						},
						{
							title: 'dinner',
							time: '1:00 pm',
							menu: ['Vegetable salad', 'Mushroom soup', 'Cherry compote', 'Bread']
						},
						{
							title: 'supper',
							time: '6:00 pm',
							menu: ['Sausages with roasted potatoes', 'Cup of tea', 'Apple pie', 'Good movie to watch']
						}
					],
				},
				template: "<h3>Dear {{guestName}}, your menu for today is:</h3>" +
				"<ul>" +
					"{{#meal}}" +
						"<li>" +
							"<b>{{ucFirst title}}</b><br />" +
							"Time: {{time}}<br />" +
							"Dishes: {{implode menu}}" +
						"</li>" +
					"{{/meal}}" +
				"</ul>",
				name: 'menu',
				result: '<h3>Dear Steve, your menu for today is:</h3><ul><li><b>Breakfast</b><br />Time: 9:00 am<br />Dishes: Cup of coffee, Sandwich, Cigarette</li><li><b>Dinner</b><br />Time: 1:00 pm<br />Dishes: Vegetable salad, Mushroom soup, Cherry compote, Bread</li><li><b>Supper</b><br />Time: 6:00 pm<br />Dishes: Sausages with roasted potatoes, Cup of tea, Apple pie, Good movie to watch</li></ul>'
			},
			{
				data: {
					basket: {
						length: 4,
						0: {
							name: 'Fish&Chips',
							quantity: 3,
							price: 10
						},
						1: {
							name: 'Pair of socks',
							quantity: 5,
							price: 700
						},
						2: {
							name: 'Microwave owen',
							quantity: 1,
							price: 1500
						},
						3: {
							name: 'Mercedes 600',
							quantity: 1,
							price: 900000000,
							discount: 0.03
						}
					},
					payment: [
						{title: 'Visa/Master Card', value: 'card'},
						{title: 'Cash', value: 'cash', default: true}
					]
				},
				template:
					"<form>" +
						"<h3>Your order is:</h3>" +
						"<div class=\"container\">" +
							"{{#if isNotEmpty basket}}" +
							"<table cellpadding=\"0\" cellspacing=\"0\">" +
								"<thead><tr><th>Name</th><th>Price</th><th>Quantity</th><th>Cost</th></tr></thead>" +
								"<tbody>" +
									"{{#basket}}" +
									"<tr>" +
										"<td>{{name}}</td>" +
										"<td>${{price}}</td>" +
										"<td>{{quantity}}</td>" +
										"<td>{{#if discount}}<s>{{/if}}${{getCost this this}}{{#if discount}}</s> (with discount: ${{getDiscountCost this}}){{/if}}</td>" +
									"</tr>" +
									"{{/basket}}" +
								"</tbody>" +
							"</table>" +
							"{{else}}<span class=\"red\">Your basket is empty</span>{{/if}}" +
						"</div>" +
						"Total price: <span class=\"green\">${{totalPrice basket}}</span><br /><br />" +
						"Pay with: " +
						"<select>" +
							"{{#payment}}" +
								"<option value=\"{{value}}\" {{#if default}} selected=\"selected\"{{/if}}>{{title}}</option>"+
							"{{/payment}}" +
						"</select>" +
					"</form>",
				name: 'cart',
				result: '<form><h3>Your order is:</h3><div class=\"container\"><table cellpadding=\"0\" cellspacing=\"0\"><thead><tr><th>Name</th><th>Price</th><th>Quantity</th><th>Cost</th></tr></thead><tbody><tr><td>Fish&amp;Chips</td><td>$10</td><td>3</td><td>$30</td></tr><tr><td>Pair of socks</td><td>$700</td><td>5</td><td>$3500</td></tr><tr><td>Microwave owen</td><td>$1500</td><td>1</td><td>$1500</td></tr><tr><td>Mercedes 600</td><td>$900000000</td><td>1</td><td><s>$900000000</s> (with discount: $27000000)</td></tr></tbody></table></div>Total price: <span class=\"green\">$27005030</span><br /><br />Pay with: <select><option value=\"card\" >Visa/Master Card</option><option value=\"cash\"  selected=\"selected\">Cash</option></select></form>'
			},
			{
				data: {
					basket: {
						length: 4,
						0: {
							name: 'Fish&Chips',
							quantity: 3,
							price: 10
						},
						1: {
							name: 'Pair of socks',
							quantity: 5,
							price: 700
						},
					},
					payment: [
						{title: 'Visa/Master Card', value: 'card'},
						{title: 'Cash', value: 'cash', default: true}
					]
				},
				template: '<la>{{getCostAlt basket.0 this}}</la>',
				name: 'basket_sum',
				result: '<la>30 of Cash</la>'
			},
			{
				data: {
					weapon: [
						{
							name: 'Glock-17',
							type: 'P',
							sides: ['CT'],
							inManual: false
						},
						{
							name: 'MP-5',
							type: 'R',
							sides: ['CT', 'T'],
							inManual: true
						},
						{
							name: 'AK-47',
							type: 'R',
							sides: ['T']
						},
						{
							name: 'Kevlar',
							type: 'A',
							sides: ['CT', 'T'],
							inManual: true
						}
					]
				},
				template:
					"<h3>Counter-Strike 1.6 weapons:</h3>" +
					"<ul>" +
						"{{#weapon}}" +
							"<li>{{name}}, type: {{#if isPistol this}}Pistol{{elseif isRifle this}}Rifle{{elseif isArmor this}}Armor{{else}}Unknown{{/if}}<br />" +
								"Who can buy:<ul>" +
									"{{#sides}}" +
										"<li>{{getFactionName this}}{{#../../inManual}}&nbsp;&nbsp;<a href=\"#{{../../name}}\">See game manual</a>{{/../../inManual}}</li>" +
									"{{/sides}}" +
								"</ul>" +
							"</li>" +
						"{{/weapon}}" +
					"</ul>",
				name: 'cs',
				result: '<h3>Counter-Strike 1.6 weapons:</h3><ul><li>Glock-17, type: Pistol<br />Who can buy:<ul><li>CT Forces</li></ul></li><li>MP-5, type: Rifle<br />Who can buy:<ul><li>CT Forces&nbsp;&nbsp;<a href=\"#MP-5\">See game manual</a></li><li>Terrorists&nbsp;&nbsp;<a href=\"#MP-5\">See game manual</a></li></ul></li><li>AK-47, type: Rifle<br />Who can buy:<ul><li>Terrorists</li></ul></li><li>Kevlar, type: Armor<br />Who can buy:<ul><li>CT Forces&nbsp;&nbsp;<a href=\"#Kevlar\">See game manual</a></li><li>Terrorists&nbsp;&nbsp;<a href=\"#Kevlar\">See game manual</a></li></ul></li></ul>'
			},
			{
				data: {
					jumps: [
						{
							personA: 'brown fox',
							personB: 'dog'
						},
						{
							personA: 'crazy elk',
							personB: 'brutal crocodile'
						},
						{
							personA: 'smelly squirrel',
							personB: 'gorgeous giraffe'
						}
					]
				},
				template: "<h3>Jumping around:</h3> {{#jumps}} {{> jumping}} <br /> {{/jumps}}",
				name: 'jumpingPairs',
				result: '<h3>Jumping around:</h3>  The quick &laquo;brown fox&raquo; jumps over the lazy &laquo;dog&raquo; <br />  The quick &laquo;crazy elk&raquo; jumps over the lazy &laquo;brutal crocodile&raquo; <br />  The quick &laquo;smelly squirrel&raquo; jumps over the lazy &laquo;gorgeous giraffe&raquo; <br /> '
			}
		];
	}
};
