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

	public static function convertTimeStamp($stamp)
	{
		$date = new DateTime();
		$date->setTimestamp($stamp);
		return $date->format('d.m.Y H:i');
	}

	public static function produceNavButtons($products)
	{
		$buttons = array();
		if(is_array($products))
		{
			foreach($products as $k => $v)
			{
				$buttons[] = array('imgId' => $v['id'], 'num' => $k + 1);
			}
		}

		return $buttons;
	}

	public static function getDataById($id, array $data)
	{
		foreach($data as $k => $v)
		{
			if($v['id'] == $id)
			{
				return $v;
			}
		}

		return $data[0];
	}
}

Horns::registerGlobalHelpers('HelperSource');