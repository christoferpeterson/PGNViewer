var pgnViewerModule = function() {};

pgnViewerModule.prototype = new Module();

pgnViewerModule.prototype.elementMap = {
	'notation' : 'pre.notationWindow'
};

pgnViewerModule.prototype.initModule = function () {
	this.startingFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

	// generate the useful local variables
	this.pgns = [];
	this.currentGame;
	this.currentPosition = [];

	// build the module
	this.buildModule();

	this.loadGame(0);
};

pgnViewerModule.prototype.buildModule = function() {
	// load in the PGNs from the dom
	this.loadPGNs();

	var $pgnSelect = $('<select data-changeaction="loadGame">');
	var $notationWindow = $('<pre class="notationWindow" />')

	var pgn;
	for (var i = 0; i < this.pgns.length; i++) {
		pgn = this.pgns[i];
		$pgnSelect.append($('<option value="' + i + '">' + pgn.white + ' (' + pgn.whiteelo + ') - ' + pgn.black + ' (' + pgn.blackelo + ')</option>'))
	};

	this.$module.append($pgnSelect, $notationWindow);
};

pgnViewerModule.prototype.action_loadGame = function($el, val, e) {
	this.loadGame(val);
};

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

// update the move window interface with the current moves
pgnViewerModule.prototype.displayMoves = function() {
	this.$el('notation').empty();
	var moveOutput = function(rMoves, prepend) {
		prepend = prepend || '';
		var s = [];
		for (var i = 0; i < rMoves.length; i++) {
			s.push(prepend + rMoves[i].fullText);

			if(rMoves[i].variations) {
				for (var j = 0; j < rMoves[i].variations.length; j++) {
					s = s.concat(moveOutput(rMoves[i].variations[j], prepend + '\t'));
				};
			}
		};
		return s;
	}

	var text = moveOutput(this.currentGame.moves);
	this.$el('notation').html(text.join('<br />'));
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

	var chessBoard = new ChessBoard();

	moves = chessBoard.validate(moves, fen);

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
				NAG: arguments[5],
				commentAfter: (arguments[6] || "").trim(),
				variations: [],
				player: 'w'
			});
		}

		// get the details for the black move
		if(arguments[7])
		{
			moves.push({
				fullText: arguments[7],
				plyCount: (arguments[9] || arguments[3]) * 2,
				moveNumber: parseInt(arguments[9] || arguments[3]),
				commentBefore: (arguments[8] || "").trim(),
				algebraic: arguments[10],
				NAG: arguments[11],
				commentAfter: (arguments[12] || "").trim(),
				variations: [],
				player: 'b'
			});
		}
	});

	return moves;
}

// Returns a constructed regex necessary for parsing chess moves
pgnViewerModule.prototype.moveRegex = function() {
	if(!this._moveRegex)
	{
		// the regex for finding chess moves
		// ***** TO DO ***** UPDATE TO SUPPORT CASTLE WITH ZEROES
		var moveRegex = '(?:([PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:\\=[PNBRQK])?|O(?:-?O){1,2})[\\+#]?)(?:\\s*(?:[\\!\\?]+|\\s*(\\$\\d+)))?\\s*'
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