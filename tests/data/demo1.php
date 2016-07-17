<?
$time = 1468763432;

$data = [
	'product' => [
		[
			'id' => 100,
			'name' => 'A european church interior',
			'src' => 'abbey-1160492_640.jpg',
			'comments' => [
				[
					'author' => 'Jamal Jamilco',
					'text' => 'I just love it!',
					'date' => $time,
				],
				[
					'author' => 'Hacker-smacker!',
					'text' => '/><script>alert("HACK!")</script><',
					'date' => $time + 3600,
				],
				[
					'author' => 'Jon Smith',
					'text' => 'Where was this photo taken?',
					'date' => $time + 1111,
				],
				[
					'author' => 'Buy new pills!',
					'text' => 'I would not have believed in, if I had not tried it by myself. These new pills...',
					'date' => $time + 3600,
				],
			]
		],
		[
			'id' => 200,
			'name' => 'Abbey ruin',
			'src' => 'sweetheart-abbey-1037477_640.jpg',
			'comments' => [
				[
					'author' => 'Viktor Jobinski',
					'text' => 'Awesome stuff man!',
					'date' => $time + 3600,
				],
				[
					'author' => 'Hacker-smacker!',
					'text' => '/><script>alert("HACK!")</script><',
					'date' => $time + 8640,
				],
			]
		],
		[
			'id' => 300,
			'name' => 'Another kicking-ass ruin',
			'src' => 'abbey-939529_640.jpg',
			'comments' => [
				[
					'author' => 'User user',
					'text' => 'Its great!',
					'date' => $time + 3600,
				],
			]
		],
	]
];