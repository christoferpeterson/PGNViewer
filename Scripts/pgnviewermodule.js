var pgnViewerModule = function() {};

pgnViewerModule.prototype = new Module();

pgnViewerModule.prototype.elementMap = {
	'notation' : 'div.notationWindow',
	'board' : 'div.board',
	'backward': '[data-clickaction="prevMove"], [data-clickaction="start"]',
	'forward': '[data-clickaction="nextMove"], [data-clickaction="end"]',
	'clickMove': '[data-clickaction="clickMove"]',
	'comments': 'div.comments',
	'fenInput': 'input[name="fen"]'
};

pgnViewerModule.prototype.initModule = function () {
	this.startingFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

	// generate the useful local variables
	this.pgns = [];
	this.currentGame;
	this.currentPosition = [];
	this.flip = false;
	this.hideAnnotations = false;

	// build the module
	this.buildModule();

	// load the first game
	this.loadGame(0);

	// get the starting position
	this.updateBoard(this.chessBoard.startingPosition);
};

pgnViewerModule.prototype.action_download = function($el, val, e) {
	var content;
	if(this.hideAnnotations) {
		content = this.getPlainGame(this.currentGame);
	}
	else {
		content = this.currentGame.pgn;
	}

	var a = document.createElement('a');
	var blob = new Blob([content], {'type':'application\/octet-stream'});
	a.href = window.URL.createObjectURL(blob);
	a.download = this.currentGame.white + ' - ' + this.currentGame.black + '.pgn';
	a.click();
};

pgnViewerModule.prototype.action_toggleAnnotations = function($el, val, e) {
	this.hideAnnotations = val;
}

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

	var $boardWrapper = $('<div class="boardWrapper"></div>');
	var $board = $('<div class="board"></div>');
	var $notationWrapper = $('<div class="notationWrapper"></div>');
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
	$boardWrapper.append($board, $controls);
	$notationWrapper.append($notationWindow, $('<label>FEN: <input type="text" name="fen" /></label>'))

	this.$module.append($boardWrapper, $notationWrapper, $comments);
};
pgnViewerModule.prototype.buildControls = function() {
	var $c = $('<div class="controls"></div>');
	var $pgnSelect = $('<select data-changeaction="loadGame">');

	$c.append($('<button data-clickaction="start">start</button>'));
	$c.append($('<button data-clickaction="prevMove">prev</button>'));
	$c.append($('<button data-clickaction="nextMove">next</button>'));
	$c.append($('<button data-clickaction="end">end</button>'));
	$c.append($('<button data-clickaction="flip">flip</button>'));
	$c.append($('<button data-clickaction="download">get pgn</button>'))
	$c.append($('<label><input data-changeaction="toggleAnnotations" type="checkbox" /> Hide annotations</label>'));

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
pgnViewerModule.prototype.loadGame = function(gameNumber, noAnnotations) {
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

pgnViewerModule.prototype.updateBoard = function(board, move) {
	// get the new board
	var diagram = this.generateDiagram(board);
	var move = move || this.chessBoard.currentMoveObject;

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

	if(move === undefined || move.fen === undefined) {
		this.$el('fenInput').val(this.chessBoard.convertBoardToFEN(this.chessBoard.startingPosition));
	}
	else {
		this.$el('fenInput').val(move.fen);
	}

	this.$el('notation').scrollTop(newScrollPos);

	if(move && move.fullText !== undefined) {
		var moveText = [];
		moveText.push('<p>');

		moveText.push(move.commentBefore || '');
		moveText.push(' ');

		moveText.push('<strong>')
		moveText.push(move.moveNumber);
		moveText.push(move.player === 'w' ? '. ' : '... ')
		moveText.push(move.algebraic);

		if(move.check !== undefined) {
			moveText.push(move.check);
		}
		if(move.NAG !== undefined) {
			moveText.push(pgnViewerModule.NAGMap[move.NAG]);
		}

		moveText.push('</strong>')

		if(move.commentAfter) {
			moveText.push(' ');
			moveText.push(move.commentAfter);
		}

		moveText.push('</p>');

		this.$el('comments').html(moveText.join(''));
	}
	else {
		this.$el('comments').empty();
	}

	// display the board on the screen
	this.$el('board').html(diagram);
}

pgnViewerModule.prototype.displayMoves = function() {
	this.$el('notation').html(this.setupNotation(this.chessBoard.moves));
}

// update the move window interface with the current moves
pgnViewerModule.prototype.setupNotation = function(rMoves, variationNumber) {
	var html = [];

	var renderMoves = function(moveArray, addressPrepend) {
		var output = [];
		var i = 0;
		var j = 0;
		var address = [];
		var numberSet = false;
		var whiteMove = false;
		var blackMoveFirst = false;

		while(i < moveArray.length) { // loop over all the moves provided
			numberSet = false;
			blackMoveFirst = false;
			j = 0;

			while(j < 2) { // get the white and black moves
				if(moveArray[i+j]) { // the actual move
					
					address = []; // Reset the move address
					if(addressPrepend) {
						// add the prepend if necessary
						address.push(addressPrepend);
					}

					address.push(i+j); // add the move number to the address
					// open the clickable region
					html.push(' <span data-clickaction="clickMove" data-actionvalue="' + address.join('.') + '">');

					if(!numberSet) { // generate the move number
						if(moveArray[i+j].player === 'w') {
							whiteMove = true;
							html.push(moveArray[i+j].moveNumber + '. '); 
						}
						else {
							blackMoveFirst = !whiteMove;
							html.push(moveArray[i+j].moveNumber + '... ');
						}

						numberSet = true;
					}
					

					moveArray[i+j].address = address.join('.');

					html.push(moveArray[i+j].algebraic + (moveArray[i+j].check || '')); // add the algebraic move

					if(moveArray[i+j].NAG !== undefined) {
						html.push(pgnViewerModule.NAGMap[moveArray[i+j].NAG]);
					}

					if(moveArray[i+j].commentBefore !== '' || moveArray[i+j].commentAfter !== '') {
						html.push('*');
					}


					html.push('</span>'); // close the clickable region

					if(moveArray[i+j].variations.length > 0) { // use recrusion to render the variations
						for (var k = 0; k < moveArray[i+j].variations.length; k++) {
							html.push('<span class="variation">( '); // open the variation
							
							address = []; // Reset the move address
							if(addressPrepend) {
							// add the prepend if necessary
								address.push(addressPrepend);
							}

							address.push(i+j); // add the move number to the address

							address.push(k+1); // add the variation number to the address

							// recursively render variations
							var obj = renderMoves(moveArray[i+j].variations[k], address.join('.'))
							moveArray[i+j].variations[k] = obj.moves;
							html.push(obj.html);

							html.push(' )</span>'); // close the variation
						}

						numberSet = false;
					}
				}

				// handle for when a black move is first in the move array
				j += blackMoveFirst ? 2 : 1;
			}
			
			// handle for when a black move is first in the move array
			i += blackMoveFirst ? 1 : 2;
		}

		return { html: output.join(''), moves: moveArray };
	}

	var obj = renderMoves(rMoves);
	this.chessBoard.moves = obj.moves;
	html.push(obj.html);
	return html.join('');
}

// Given a PGN, this will return a pgn stripped of all annotations and variations
pgnViewerModule.prototype.getPlainGame = function(game) {
	if(game === undefined || game.pgn === undefined){
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

	var variations = pgn.buildNestedObject('(', ')');
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
	var subVariations;
	var moves = [];
	var move;

	if(rVariations === undefined) {
		return moves;
	}

	for (var i = 0; i < rVariations.length; i++) {
		move = this.convertStringToMoves(rVariations[i].text);

		if(rVariations[i].sub) {
			subVariations = [];

			for (var j = 0; j < rVariations[i].sub.length; j++) {
				subVariations = this.convertVariationsToMoves(rVariations[i].sub);
			};

			move = this.mergeMovesAndVariations(move, subVariations);
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

			if(rVariations[i].length > 0) {
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
				  + ')?'
				  + '(' // capture full text associated with black's move
				  + 	commentRegex // comment before move
				  + 	'(?:(?:(?:\\s*)?(\\d+))\\.{0,3}\\s*)?' // optional move number indicator on black's move
				  +		moveRegex // move
				  +		commentRegex // comment after move
				  + ')?(?=(?:[^"]*"[^"]*")*[^"]*$)'
				;

		this._moveRegex = regex;
	}
	return this._moveRegex;
}

pgnViewerModule.NAGMap = {
	'$0': '', // null annotation
	'$1': '!', // good move
	'$2': '?', // poor move or mistake
	'$3': '!!', // very good or brilliant move
	'$4': '??', // very poor move or blunder
	'$5': '!?', // speculative or interesting move
	'$6': '?!', // questionable or dubious move
	'$7': '□', // forced move (all others lose quickly) or only move
	'$8': '', // singular move (no reasonable alternatives)
	'$9': '', // worst move
	'$10': '=', // drawish position or even
	'$11': '', // equal chances, quiet position
	'$12': '', // equal chances, active position
	'$13': '∞', // unclear position
	'$14': '+/=', // White has a slight advantage
	'$15': '=/+', // Black has a slight advantage
	'$16': '&plusmn;', // White has a moderate advantage
	'$17': '&#8723;', // Black has a moderate advantage
	'$18': '&#43;&minus;', // White has a decisive advantage
	'$19': '&minus;&#43;' // Black has a decisive advantage
}