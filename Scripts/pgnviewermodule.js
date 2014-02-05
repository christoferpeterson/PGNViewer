var pgnViewerModule = function() {};

pgnViewerModule.prototype = new Module();

pgnViewerModule.prototype.elementMap = {
	'notation' : 'div.notationWindow',
	'board' : 'div.board',
	'backward': '[data-clickaction="prevMove"], [data-clickaction="start"]',
	'forward': '[data-clickaction="nextMove"], [data-clickaction="end"]',
	'clickMove': '[data-clickaction="clickMove"]'
};

pgnViewerModule.prototype.initModule = function () {
	this.startingFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

	// generate the useful local variables
	this.pgns = [];
	this.currentGame;
	this.currentPosition = [];
	this.flip = false;

	// build the module
	this.buildModule();

	// load the first game
	this.loadGame(0);

	// get the starting position
	this.updateBoard(this.chessBoard.startingPosition);
};

pgnViewerModule.prototype.action_loadGame = function($el, val, e) {
	this.loadGame(val);
};

pgnViewerModule.prototype.action_flip = function($el, val, e) {
	this.chessBoard.flip = !this.chessBoard.flip;
	this.updateBoard();
};

pgnViewerModule.prototype.action_nextMove = function($el, val, e) {
	this.loadNextMove();
};

pgnViewerModule.prototype.action_prevMove = function($el, val, e) {
	var move = this.chessBoard.prevMove();

	if(move) {
		this.updateBoard();
	}
};

pgnViewerModule.prototype.action_start = function($el, val, e) {
	var move = this.chessBoard.jumpToMove(-1);

	if(move) {
		this.updateBoard();
	}
};

pgnViewerModule.prototype.action_end = function($el, val, e) {
	var move = this.chessBoard.jumpToMove(this.chessBoard.moves.length-1);

	if(move) {
		this.updateBoard();
	}
};

pgnViewerModule.prototype.action_clickMove = function($el, val, e) {
	var move = this.chessBoard.jumpToMove(val);

	if(move) {
		this.updateBoard();
	}
};

pgnViewerModule.prototype.loadNextMove = function() {
	var move = this.chessBoard.nextMove();

	if(move) {
		this.updateBoard();
	}
};


pgnViewerModule.prototype.buildModule = function() {
	// load in the PGNs from the dom
	this.loadPGNs();

	var $board = $('<div class="board"></div>');
	var $notationWindow = $('<div class="notationWindow"></div>');
	var $comments = $('<div class="comments"></div>');
	var $controls = this.buildControls();

	var b = [];
	b.push('XABCDEFGHY');
	b.push('8-+-+-+-+(');
	b.push('7+-+-+-+-\'');
	b.push('6-+-+-+-+&');
	b.push('5+-+-+-+-%');
	b.push('4-+-+-+-+$');
	b.push('3+-+-+-+-#');
	b.push('2-+-+-+-+"');
	b.push('1+-+-+-+-!');
	b.push('xabcdefghy');

	$board.html(b.join('<br />\r\n'));

	
	this.$module.append($board, $notationWindow, $comments, $controls);
};
pgnViewerModule.prototype.buildControls = function() {
	var $c = $('<div class="controls"></div>');
	var $pgnSelect = $('<select data-changeaction="loadGame">');

	$c.append($('<button data-clickaction="start">start</button>'));
	$c.append($('<button data-clickaction="prevMove">prev</button>'));
	$c.append($('<button data-clickaction="nextMove">next</button>'));
	$c.append($('<button data-clickaction="end">end</button>'));
	$c.append($('<button data-clickaction="flip">flip</button>'));

	var pgn;
	for (var i = 0; i < this.pgns.length; i++) {
		pgn = this.pgns[i];
		$pgnSelect.append($('<option value="' + i + '">' + pgn.white + ' (' + pgn.whiteelo + ') - ' + pgn.black + ' (' + pgn.blackelo + ')</option>'))
	};

	if(this.pgns.length > 1) {
		$c.append($pgnSelect);
	}

	return $c;
}

// load a game from the list of games
pgnViewerModule.prototype.loadGame = function(gameNumber) {
	if(!this.pgns[gameNumber]) {
		this.showError('Unable to locate that game.')
		return false;
	}

	// set the current game
	this.currentGame = this.pgns[gameNumber];
	// parse the current games moves
	this.currentGame.moves = this.pgns[gameNumber].moves = this.currentGame.moves || this.getMoves(this.currentGame);

	// display the move interface
	this.displayMoves();

	return true;
};

pgnViewerModule.prototype.updateBoard = function(board) {
	// get the new board
	var diagram = this.generateDiagram(board);

	// disable or enable the backward buttons
	if(this.chessBoard.currentMove === -1)
		this.$el('backward').attr('disabled', 'disabled');
	else
		this.$el('backward').removeAttr('disabled');

	// disable or enable the forward buttons
	if(this.chessBoard.currentMove === this.chessBoard.moves.length-1)
		this.$el('forward').attr('disabled', 'disabled');
	else
		this.$el('forward').removeAttr('disabled');

	this.$el('clickMove').removeClass('active');
	var $note = this.$el('clickMove').filter('[data-actionvalue="' + this.chessBoard.currentMove + '"]');
	$note.addClass('active');

	var newScrollPos = 0;
	if($note.length > 0) {
		newScrollPos = $note.offset().top - this.$el('notation').offset().top + this.$el('notation').scrollTop();
	}

	this.$el('notation').scrollTop(newScrollPos);

	// display the board on the screen
	this.$el('board').html(diagram);
}

pgnViewerModule.prototype.displayMoves = function() {
	this.$el('notation').html(this.setupNotation(this.chessBoard.moves));
}

// update the move window interface with the current moves
pgnViewerModule.prototype.setupNotation = function(rMoves, variationNumber) {
	var html = [];
	var i = 0;
	var j = 0;
	var address = [];

	html.push('<span class="moves">');
	console.info(rMoves);

	while(i < rMoves.length) {
		j = 0;

		while(j < 2) {
			if(rMoves[i+j]) {
				address.push(rMoves[i+j].plyCount);

				if(variationNumber) {
					address.push(variationNumber);
				}

				address.push(i+j);
				
				html.push(' <span data-clickaction="clickMove" data-actionvalue="' + address.join('-') + '">');
				html.push(rMoves[i].moveNumber + '. ');
				html.push(rMoves[i+j].algebraic + (rMoves[i+j].check || ''));
				html.push('</span>');
				if(rMoves[i+j].variations.length > 0) {
					html.push('<span class="variations">');
					for (var k = 0; k < rMoves[i+j].variations.length; k++) {
						if(variationNumber) {
							variationNumber += '-' + (k+1);
						}
						else {
							variationNumber = k+1;
						}
						html.push(this.setupNotation(rMoves[i+j].variations[k], variationNumber));
					};
					html.push('</span>');
				}
			}
			j++;
		}

		i += 2;
	}
	html.push('</span>');

	return html.join('');
}

// Given a PGN, this will return a pgn stripped of all annotations and variations
pgnViewerModule.prototype.getPlainGame = function(game) {
	if(pgn == undefined){
		this.showError('Invalid PGN provided');
	}

	var plainGame = '';

	// remove comments, extra move numbers, and annotations (including NAG)
	plainGame = game.pgn.replace(/(\s{0,1}[0-9]+\.{2,3})|(\s{0,1}\$[0-9]+)|(\s{0,1}\{.*?\}+)/ig, '');

	// remove variations
	var exclude = plainGame.nestedExclude('(', ')');
	plainGame = exclude.output;

	return plainGame;
};

// Gram the PGNs from various locations, either from the DOM or a file
pgnViewerModule.prototype.loadPGNs = function() {
	var pgnString = "";
	if(this.$module.data('pgn')) {
		pgnString += " " + this.$module.data('pgn');
	}
	if(this.$module.data('pgn-file')) {
		// Use AJAX to get the listed file
	}

	// separate the PGNs by their result
	// search for 1-0, 0-1, 1/2-1/2, ½\-½, or * but exclude any that fall between quotes or curly braces
	var regex = /(1\-0|0\-1|1\/2\-1\/2|½\-½\*)(?=(?:[^{]*{[^}]*})*[^}]*$)(?=(?:[^"]*"[^"]*")*[^"]*$)/ig;
	var pgnArray = pgnString.split(regex);
	
	// remove empty values
	pgnArray.clean('');
	pgnArray.clean(' ');
	// remove undefined values
	pgnArray.clean(undefined);

	// combine the pgn with the separated result to get a complete pgn
	var count = 0;
	for (var i = 0; i < pgnArray.length; i++) {
		this.pgns[count] = this.buildGameFromPGN((pgnArray[i] + pgnArray[i+1]).trim());
		count++;
		i++;
	};
	// remove the uncessary pgnArray
	delete pgnArray;

	if(this.pgns.length === 0)
	{
		this.showError('No valid PGNs found.');
	}
};

/*
	Given a PGN, this method will parse out the tags, moves, 
	variations, and comments so they will be in a useable form
*/
pgnViewerModule.prototype.buildGameFromPGN = function(pgn) {
	var game = { pgn: pgn };

	// select the words that follow an open square brace and the quotes after
	var regex = /(\[\s*(\w+)\s*"([^"]*)"\s*\]\s*)(?=(?:[^{]*{[^}]*})*[^}]*$)+/ig;
	pgn.replace(regex, function(fullMatch,fullTag, tagName, tagValue) { game[tagName.toLowerCase()] = tagValue; });
	game.fen = game.fen || this.startingFEN;

	return game;
}

// convert a full pgn to useable moves
pgnViewerModule.prototype.getMoves = function(game) {
	var pgn = game.pgn;
	var fen = game.fen;

	var variations = pgn.buildNestedObject("(", ")");
	var moves = this.convertStringToMoves(pgn);

	variations = this.convertVariationsToMoves(variations);
	moves = this.mergeMovesAndVariations(moves, variations);

	delete variations;

	this.chessBoard = new ChessBoard();

	this.chessBoard.setMoves(moves, fen);

	return moves;
}

// Converts nested variation strings to useable moves
pgnViewerModule.prototype.convertVariationsToMoves = function(rVariations) {
	var moves = [];
	var move;

	for (var i = 0; i < rVariations.length; i++) {
		move = this.convertStringToMoves(rVariations[i].text);

		if(rVariations[i].sub) {
			for (var j = 0; j < rVariations[i].sub.length; j++) {
				move.variations = this.convertVariationsToMoves(rVariations[i].sub[j]);
			};
		}

		moves.push(move);
	};

	return moves;
};

// combine variations and moves so they are no longer separated
pgnViewerModule.prototype.mergeMovesAndVariations = function(rMoves, rVariations) {
	if(rMoves && rVariations)
	{
		var moveIndex;
		for (var i = 0; i < rVariations.length; i++) {

			if(rVariations[i].length > 0){
				moveIndex = rMoves.searchByProperty("plyCount", rVariations[i][0].plyCount);
				if(moveIndex === -1) {
					continue;
				}
				else {
					rMoves[moveIndex].variations.push(rVariations[i]);
				}
			}
		};
	}

	return rMoves;
};

pgnViewerModule.prototype.displayBoard = function() {
	if(!this.currentPosition || this.currentPosition.length != 9) {
		console.info('Warning, no valid board to display.');
	}
};

// Display an error message
pgnViewerModule.prototype.showError = function(message) {
	alert('PGN Viewer Error: ' + message)
}



// Parses a set of moves
pgnViewerModule.prototype.convertStringToMoves = function(sMoves) {
	var excludeVariations = sMoves.nestedExclude("(", ")");
	var pgn = excludeVariations.output;

	var moves = [];

	pgn.replace(new RegExp(this.moveRegex(), "gi"), function() {
		// get the details for the white move
		if(arguments[1])
		{
			moves.push({
				fullText: arguments[1],
				commentBefore: (arguments[2] || "").trim(),
				plyCount: arguments[3] * 2 - 1,
				moveNumber: parseInt(arguments[3]),
				algebraic: arguments[4],
				check: arguments[5],
				NAG: arguments[6],
				commentAfter: (arguments[7] || "").trim(),
				variations: [],
				player: 'w'
			});
		}

		// get the details for the black move
		if(arguments[8])
		{
			moves.push({
				fullText: arguments[8],
				plyCount: (arguments[10] || arguments[3]) * 2,
				moveNumber: parseInt(arguments[10] || arguments[3]),
				commentBefore: (arguments[9] || "").trim(),
				algebraic: arguments[11],
				check: arguments[12],
				NAG: arguments[13],
				commentAfter: (arguments[14] || "").trim(),
				variations: [],
				player: 'b'
			});
		}
	});

	return moves;
}

pgnViewerModule.prototype.diagramBorderMap = [
	undefined, '!','"','#','$','%','&', '\'', '('
]

// Displays the chess board using USCF's diagram font
pgnViewerModule.prototype.generateDiagram = function(board) {
	board = board || this.chessBoard.currentPosition;
	var type = typeof board;
	var output = [];
	var rank;
	var darkSquare;
	var i = 0;
	var j = 0;
	var pos;
	var rankNumber;
	var isDark;

	// if an FEN was provided, update the position
	if(type === 'string') {
		board = this.parseFEN(board);
	}

	//this.flip = true;

	// show the top border of the board
	if(this.chessBoard.flip)
		output.push('XHGFEDCBAY');
	else
		output.push('XABCDEFGHY');

	// depending on orientation, the counter needs to go up or down
	i = this.chessBoard.flip ? 7 : 56;

	// used to determine if the squares will be dark or light
	darkSquare = this.flip;

	while(i < 64 && i >= 0) {
		j = 0;
		rank = [];
		rankNumber = this.chessBoard.flip ? (i+1)/8 : (i+8)/8;

		// add the left border
		rank.push(rankNumber);

		while(j < 8) {

			// determine if the square should be dark or light
			isDark = (darkSquare && pos%2 !== 0) || (!darkSquare && (pos)%2 === 0)

			// calculate the current board position
			pos = this.chessBoard.flip ? i-j : i+j;

			// if the square is occupied
			if(board.squares[pos]) {
				if(isDark) {
					rank.push(board.squares[pos].blackSquare);
				}
				rank.push(board.squares[pos].diagram);
			}

			// display an empty square
			else {
				if(isDark)
					rank.push('+');
				else
					rank.push('-');
			}
			
			j++; // continue across the rank
		}

		// add the right border
		rank.push(this.diagramBorderMap[rankNumber]);

		i+= this.chessBoard.flip ? 8 : -8;

		// join the rank text
		output.push(rank.join(''));

		// switch the darksquare marker
		darkSquare = !darkSquare;
	}

	// show the bottom border of the board
	if(this.chessBoard.flip)
		output.push('xhgfedcbay');
	else
		output.push('xabcdefghy');

	// join all the text required for the diagram
	return output.join('<br />');
};

// Returns a constructed regex necessary for parsing chess moves
pgnViewerModule.prototype.moveRegex = function() {
	if(!this._moveRegex)
	{
		// the regex for finding chess moves
		// ***** TO DO ***** UPDATE TO SUPPORT CASTLE WITH ZEROES
		var moveRegex = '(?:([PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:\\=[PNBRQK])?|(?:O|0)(?:-?(?:O|0)){1,2})([\\+#])?)(?:\\s*(?:[\\!\\?]+|\\s*(\\$\\d+)))?\\s*'
		// optional comments (between curly braces)
		var commentRegex = '(?:\\s*\\{([^\}]*)\\})?';

		// Because variations are nested, it is better to use a different method than regex to parse
		// optional variations (between parentheses)
		//var variationRegex = ''; //'(\\s*(?:\\((?:[^\\)]*)\\)\\s*)+)?';

		var regex = '(' // Capture full text associated with white's move
				  + 	commentRegex // comment before move
				  + 	'((?:\\s*)?\\d+)\\.\\s*' // Move number and spaces
				  + 	moveRegex // move
				  + 	commentRegex // comment after move
				  + ')'
				  + '(' // capture full text associated with black's move
				  + 	commentRegex // comment before move
				  + 	'(?:(?:(?:\\s*)?(\\d+))\\.{0,3}\\s*)?' // optional move number indicator on black's move
				  +		moveRegex // move
				  +		commentRegex // comment after move
				  + ')?'
				;

		this._moveRegex = regex;
	}
	return this._moveRegex;
}