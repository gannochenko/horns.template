(function(){

	window.Application = {};
	window.Application.GalleryController = function(options)
	{
		Horns.registerGlobalHelper();
		Horns.registerGlobalHelpers();

		console.dir(options.data.product[0]);
		var same = Horns.render('card', options.data.product[0]);
		
		document.getElementById('same').innerHTML = same;
	}

}).call(this);