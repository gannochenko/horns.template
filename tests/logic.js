(function(){

	window.Application = {};
	window.Application.GalleryController = function(options)
	{
		Horns.registerGlobalHelpers({
			convertTimeStamp: function(stamp){
				var date = new Date(stamp * 1000);

				var pad = function(num)
				{
					num = num.toString();
					if(num.length == 1)
					{
						return '0'+num;
					}

					return num;
				};

				return  pad(date.getDate())+'.'+
						pad(date.getMonth() + 1)+'.'+
						date.getFullYear()+' '+
						pad(date.getHours())+':'+
						pad(date.getMinutes());
			},
			produceNavButtons: function(products){

				var result = [];
				$.each(products, function(k, product){
					result.push({imgId: product.id, num: k + 1});
				});

				return result;
			}
		});

		this.current = parseInt(options.current);
		this.data = options.data.product;

		$('.image-nav').delegate('button', 'click', $.passCtx(this.onNavClick, this));
		$('.comment-form').bind('submit', $.passCtx(this.onCommentAdd, this));
	};
	window.Application.GalleryController.prototype = {

		postComment: function(comment)
		{
			var container = document.getElementById('product-comments');
			if(container)
			{
				container.innerHTML += Horns.render('comment', comment);
			}
		},

		onNavClick: function(btn, e)
		{
			var imgId = parseInt($(btn).data('id'));

			if(imgId && imgId != this.current)
			{
				var data = this.getDataById(imgId);

				if(data)
				{
					$('.image-here').html(Horns.render('card', data));
					this.current = imgId;

					if('history' in window)
					{
						history.replaceState({}, null, '?id='+imgId);
					}
				}
			}
		},

		onCommentAdd: function(form, e)
		{
			var comment = {};

			if(form.length)
			{
				for(var k = 0; k < form.length; k++)
				{
					if(form[k].name)
					{
						comment[form[k].name] = form[k].value;
						form[k].value = '';
					}
				}
			}

			this.getCurrent().comments.push(comment);
			this.postComment(comment);

			e.preventDefault();
		},

		getCurrent: function()
		{
			return this.getDataById(this.current);
		},

		getDataById: function(id)
		{
			var found = null;
			$.each(this.data, function(k, item){

				if(item.id == id)
				{
					found = item;
				}
			});

			if(found === null)
			{
				found = this.data[0];
			}

			return found;
		}
	};

	$.passCtx = function(fn, ctx)
	{
		fn = fn || function(){};
		ctx = ctx || this;

		return function(){

			var args = Array.prototype.slice.call(arguments);
			args.unshift(this);

			fn.apply(ctx, args);
		};
	};

}).call(this);