<?
class HelperSource
{
	public static function concat($input)
	{
		$result = '';

		if(is_array($input))
		{
			$result = implode('', array_map(function($item){
				return (string) $item;
			}, $input));
		}

		return $result;
	}

	public static function convertTimeStamp($input)
	{
		return date('l jS \of F Y h:i:s A', intval($input));
	}

	public static function produceButtons()
	{
		return [['num' => 1], ['num' => 2], ['num' => 3]];
	}
}

Horns::registerGlobalHelpers('HelperSource');