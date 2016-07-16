(function(){

	window.Application = {};
	window.Application.GalleryController = function(options)
	{
		Horns.registerGlobalHelpers({
			convertTimeStamp: function(stamp){
				return new Date(stamp * 1000);
			},
			produceButtons: function(){
				return [{num: 1}, {num: 2}, {num: 3}];
			}
		});
		
		document.getElementById('same').innerHTML = Horns.render('card', options.data.product[1]);
	}

}).call(this);