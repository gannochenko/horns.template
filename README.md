# Horns Template

Horns Template is the [Handlebars](http://handlebarsjs.com/)-compatible template engine for LAMP projects.
The main goal is to implement exact the same functionality on both server (`PHP`) and client (`JavaScript`) sides.

-----------------------------------------------
[![MIT License][license-image]][license-url]

## Supported operators

Auto-escaping in placeholders:
~~~~
{{someValue}}, {{{someValue}}}
~~~~

Helper evaluation:
~~~~
{{prepareOutput fieldOne fieldTwo}}
~~~~

Nested object addressing:
~~~~
Address sub field: {{field.subfield.subsubfield}}
Address parent field: {{../../fieldInAnotherBranch}}
~~~~

Logic-less operator:
~~~~
{{#someField}}
    Enter this part if someField is true, and iterate if it is an iterable object\array
{{/someField}}
~~~~

Conditional operator:
~~~~
{{if fieldOne}}
    Field one is true
{{elseif fieldTwo}}
    Field two is true
{{else}}
    None is true
{{/if}}
~~~~

Nested template:
~~~~
{{> nestedTemplateCall}}
~~~~

## Usage example (`PHP`-driven way)

* Include `PHP` and `JavaScript` code
~~~~
<script src="/public/horns.js"></script>
<?require("horns.php");?>
~~~~

* Register `PHP` helper implementation
~~~~
<?
    Horns::registerGlobalHelpers(['convertTimeStamp' => function convertTimeStamp($stamp)
    {
        $date = new DateTime();
        $date->setTimestamp($stamp);
        return $date->format('d.m.Y H:i');
    }]);
?>
~~~~

* Provide template itself, and render it with some data on `PHP` side
~~~~
<?Horns::templateStart('card');?>
    <div class="row row-content">
        <div class="col-xs-12 gallery">
            <div class="media">
                <div class="media-left">
                    <img class="media-object" src="/public/img/{{src}}" alt="{{name}}" />
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
                    <!-- hey, nested template! -->
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
<?Horns::templateEnd([
    'src' => 'tea.jpg',
    'name' => 'Tea "Crazy Strawberry"',
    'details' => 'Fine tea, tasty and sweet',
    'comments' => [
        [
            'text' => 'Taste it, just taste it!',
            'author' => 'Mr Smith',
            'date' => 1477685989,
        ],
        [
            'text' => 'No way',
            'author' => 'Mr Brown',
            'date' => 1477686987,
        ],
    ]
]);?>
~~~~

* Register `JavaScript` helper implementation
~~~~
<script>
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
        }
    });
</script>
~~~~

* Add some more comments using `JavaScript`
~~~~
document.getElementById('product-comments').appendChild(Horns.render('comment', {
    text: 'You try it first!',
    'author' => 'Mr White',
    'date' => 1477686935,
}, true));
~~~~

## Examples & tests

In the `tests/` folder there are unit tests for both `PHP` and `JavaScript` versions. Also see `tests/demo/` to know how it works in wild. 

## Status

v0.0.1a

## Known issues

See ISSUES.md for details.
