var ChessBoard = function() {
	this.board = this.clearBoard();
};

ChessBoard.prototype.specialCases = { castleRights: undefined, enpassant: undefined };

ChessBoard.prototype.init = function(fen) {
	this.parseFEN(fen);
};

/*
	move: {
		fullText: the full text of the move,
		plyCount: the current ply count,
		moveNumber: the move number,
		commentBefore: a comment before the move,
		algebraic: the algebraic notation,
		smith: the smith notation of the move
		fen: fen position after move is played
		board: a js object => board's position after move,
		NAG: NAG annotation,
		commentAfter: comments after move,
		variations: an array of moves,
		player: w or b
	}
	sPosition = FEN representation of a chess position
*/
ChessBoard.prototype.setMoves = function(rMoves, sPosition) {
	this.startingPosition = this.parseFEN(sPosition);
	this.currentPosition = JSON.parse(JSON.stringify(this.startingPosition));
	this.moves = this.validate_moves(rMoves);
	this.currentMove = -1;
};

ChessBoard.prototype.nextMove = function() {
	return this.jumpToMove(this.currentMove+1);
};

ChessBoard.prototype.prevMove = function() {
	return this.jumpToMove(this.currentMove-1);
};

ChessBoard.prototype.jumpToMove = function(move) {
	if(typeof move === 'string') {
		var m = this.getComplexMove(move);
		this.currentMove = move;
		this.currentPosition = m.board;
		return m;
	}

	if(move < 0) {
		this.currentMove = -1;
		this.currentPosition = this.startingPosition;
		return {};
	}
	
	if(move >= this.moves.length) {
		this.currentMove = this.moves.length-1;
		this.currentPosition = this.moves[this.currentMove].board;

		return this.moves[this.currentMove];
	}

	this.currentMove = move;
	this.currentPosition = this.moves[this.currentMove].board;

	return this.moves[this.currentMove];
};

ChessBoard.prototype.getComplexMove = function(move) {
	console.info(move);
	var type = typeof move;

	if(type === 'string') {
		if(move === '0-0-0') {
			return { board: this.startingPosition };
		}

		var getMove = function(rMoves, m, isVariation) {
			var address = m.split('-');
			var moveNumber = parseInt(address.shift()) - 1;
			var variationNumber = parseInt(address.shift());

			console.info(moveNumber, variationNumber, address.join('-'), isVariation);
		}

		return getMove(this.moves, move, false);
	}

	if(type === 'number') {
		return this.moves[move];
	}
};

ChessBoard.moveRegex = /(?:(?:([PNBRQK])?([a-h]?[1-8]?)?(x)?([a-h][1-8])(?:\=([PNBRQ]))?)|(O(?:-?O){1,2})[\+#]?)/gi;
ChessBoard.prototype.validate_moves = function(rMoves, board) {
	if(rMoves) {
		// ***** TO DO ***** UPDATE TO SUPPORT CASTLE WITH ZEROES
		var algebraic;
		var validMove;
		var board = JSON.parse(JSON.stringify(board || this.startingPosition));
		for (var i = 0; i < rMoves.length; i++) {
			rMoves[i].algebraic.replace(ChessBoard.moveRegex, $.proxy(function() { 
				algebraic = {
					fullText: arguments[0],
					piece: arguments[1],
					indicator: arguments[2],
					isCapture: arguments[3] == "x",
					finalSquare: arguments[4],
					promotionPiece: arguments[5],
					castle: arguments[6],
					check: arguments[7],
					player: rMoves[i].player
				};
				try {
					validMove = this.checkMove(algebraic, board, rMoves[i]);
				}
				catch(err) {
					console.info(err);
				}
				
				rMoves[i].origin = validMove.origin;
				rMoves[i].destination = validMove.destination;
				rMoves[i].smith = validMove.smith;
				rMoves[i].board = JSON.parse(JSON.stringify(validMove.board));

				if(rMoves[i].variations.length > 0) {
					var prevBoard = rMoves[i-1] === undefined ? this.startingPosition : rMoves[i-1].board;
					for (var j = 0; j < rMoves[i].variations.length; j++) {
						rMoves[i].variations[j] = this.validate_moves(rMoves[i].variations[j], prevBoard);
					};
				}

				board = validMove.board;

			}, this));
		};
	}

	return rMoves;
};

/*
	move: {
		fullText: the full text of the move,
		piece: text representation of the piece,
		indicator: square the piece came from,
		isCapture: was something captured?,
		finalSquare: landing square,
		promotionPiece: What the piece turned into,
		castle: castled
	}
	***** TO DO ***** SUPPORT CAPTURES, CASTLE RULES, SUPPORT PROMOTIONS
*/
ChessBoard.prototype.checkMove = function(oMove, board, originalMove) {
	if(!oMove || !board ) {
		return { fen: undefined, smith: undefined, board: board };
	}

	var self = this;

	oMove.piece = (oMove.piece || 'p').toLowerCase();
	oMove.player = (oMove.player || 'w').toLowerCase();
	isWhite = oMove.player === 'w';

	if(oMove.castle)
		oMove.castle = oMove.castle.toLowerCase();

	//console.info('--', oMove.fullText, '--');
	if(oMove.castle)
	{
		var originalKingSquare = isWhite ? 4 : 60;
		var originalRookSquare;

		var finalKingSquare;
		var finalRookSquare;

		var checkSquares;

		oMove.castle = oMove.castle.toLowerCase();
		if(oMove.castle === 'o-o-o' || oMove.castle === '0-0-0')
		{
			originalRookSquare = isWhite ? 0 : 56;
			finalKingSquare = isWhite ? 2 : 58;
			finalRookSquare = isWhite ? 3 : 59;
			checkSquares = isWhite ? [2, 3, 4] : [58, 59, 60];
		}
		else if(oMove.castle === 'o-o' || oMove.castle === '0-0-0')
		{
			originalRookSquare = isWhite ? 7 : 63;
			finalRookSquare = isWhite ? 5 : 61;
			finalKingSquare = isWhite ? 6 : 62;
			checkSquares = isWhite ? [4,5,6] : [60, 61, 62];
		}

		board = this.movePiece(originalKingSquare, finalKingSquare, board);
		board = this.movePiece(originalRookSquare, finalRookSquare, board);
	}
	else
	{
		var possibleSquares = [];
		var defaultSquareNumber = this.squareMap[oMove.finalSquare];
		var square = this.to15(defaultSquareNumber); // convert to 15x15 grid

		var originSquare;
		var vectors;
		var comparePiece;

		var calculatePossibleOrigins = function(piece, vectorSet) {
			var poss = [];
			var os;

			for (var i = 0; i < vectorSet.length; i++) {
				os = self.to8(square - vectorSet[i]);
				if(board.squares[os] && board.squares[os].pieceType === piece) {
					poss.push(os);
				}
			};

			return poss;
		};

		if(oMove.isCapture) {
			if(square) {
				//console.info('no piece was found to capture');
			}
			else {
				//console.info('this piece got captured:', square);
			}
		}
		// check pawn moves
		if (oMove.piece === 'p'){
			comparePiece = isWhite ? '♙' : '♟';
			possibleSquares = calculatePossibleOrigins(comparePiece, this.pieceVector[oMove.player][comparePiece][oMove.isCapture ? 1 : 0]);
		}
		else if(oMove.piece === 'k') {
			comparePiece = isWhite ? '♔' : '♚';
			possibleSquares = calculatePossibleOrigins(comparePiece, this.pieceVector[oMove.player][comparePiece][0]);
		}
		else {
			if(oMove.piece === 'n') { // knight moves
				comparePiece = isWhite ? '♘' : '♞';
				possibleSquares = calculatePossibleOrigins(comparePiece, this.pieceVector[oMove.player][comparePiece]);
			}
			else {
				if(oMove.piece === 'b') { // bishop moves
					comparePiece = isWhite ? '♗' : '♝';
				}
				else if(oMove.piece === 'r') {
					comparePiece = isWhite ? '♖' : '♜';
				}
				else if(oMove.piece === 'q') {
					comparePiece = isWhite ? '♕' : '♛';
				}

				for (var set = 0; set < this.pieceVector[oMove.player][comparePiece].length; set++) {
					possibleSquares = possibleSquares.concat(calculatePossibleOrigins(comparePiece, this.pieceVector[oMove.player][comparePiece][set]));
				};
			}
		}

		var startSquare;
		var endSquare = defaultSquareNumber;
		var matches = [];

		if(possibleSquares.length > 0)
		{
			if(possibleSquares.length === 1) {
				startSquare = possibleSquares[0];
			}
			else if(oMove.indicator) {
				for (var i = 0; i < possibleSquares.length; i++) {
					if(this.algebraicMap[possibleSquares[i]].match(new RegExp(oMove.indicator)))
					{
						matches.push(possibleSquares[i]);
					}
				};

				if(matches.length == 1) {
					startSquare = matches[0]
				}
				else {
					throw('AMBIGUOUS MOVE: On move ' + originalMove.moveNumber + ' for ' + (isWhite ? 'white' : 'black') + ' there are two or more pieces that can move to ' + this.algebraicMap[endSquare])
				}
			}
			else {
				throw('AMBIGUOUS MOVE: On move ' + originalMove.moveNumber + ' for ' + (isWhite ? 'white' : 'black') + ' there are two or more pieces that can move to ' + this.algebraicMap[endSquare])
			}
		}
		else {
			throw ('INVALID MOVE: On move ' + originalMove.moveNumber + ' for ' + (isWhite ? 'white' : 'black') + ' there are no ' + comparePiece + '\'s that can move to ' + this.algebraicMap[endSquare]);
		}
		
		board = this.movePiece(startSquare, endSquare, board);
	}

	var fen = this.convertBoardToFEN(board);

	return { fen: fen, smith: oMove.fullText, board: board, origin: startSquare, destination: endSquare };
};


// ***** TO DO ***** EVERYTHING
ChessBoard.prototype.convertBoardToFEN = function(board) {
	var fen = '';
	
	return fen;
}

ChessBoard.prototype.movePiece = function(start, end, board) {
	if(!start || !end || !board || !board.squares) {
		throw('not enough info to move a piece start: ' + start + ', end: ' + end + ', board: ' + board);
	}

	if(board.squares[start]) {
		board.squares[end] = board.squares[start];
		board.squares[start] = undefined;
	}
	else {
		throw('no piece found');
	}

	return board;
}

// convert to 15x15 grid
ChessBoard.prototype.to15 = function(num) {
	return Math.floor(num/8)*15+num%8;
}

// convert to 8x8 grid
ChessBoard.prototype.to8 = function(num) {
	return Math.floor(num/15)*8+num%15;
}

// check if a square is under attack
ChessBoard.prototype.isUnderAttack = function(square, board, player) {
	var self = this;
	if(!square || !board || !board.squares || !player) {
		console.info('not enough information to determine if the square is under attack');
		return 0;
	}

	// convert to the 15x15 board
	square = this.to15(square);
	var checkSquare;
	var attackCount = 0;

	var checkIfAttacked = function(vector, piece) {
		var checkSquare = square - vector;
		// convert back to 8x8
		checkSquare = self.to8(checkSquare);
		return board.squares[checkSquare] && board.squares[checkSquare].pieceType === piece;
	};

	var vectors = this.pieceVector[player === 'w' ? 'b' : 'w'];
	for(var key in vectors) {
		// if it is a pawn
		if(key === '♙' || key === '♟') {
			for (var i = 0; i < vectors[key][1].length; i++) {
				if(checkIfAttacked(vectors[key][1][i], key)) {
					attackCount++;
				}
			};
		}
		else if(key === '♘' || key === '♞') {
			for (var i = 0; i < vectors[key].length; i++) {
				if(checkIfAttacked(vectors[key][i], key)) {
					attackCount++;
				}
			};
		}
		// if it is a king
		else if(key === '♔' || key === '♚') {
			for (var i = 0; i < vectors[key][0].length; i++) {
				if(checkIfAttacked(vectors[key][0][i], key)) {
					attackCount++;
				}
			};
		}
		// any other pieces
		else {
			for (var vectorSet = 0; vectorSet < vectors[key].length; vectorSet++) {
				var i = 0;
				for (var i = 0; i < vectors[key][vectorSet].length; i++) {
					var checkSquare = square - vectors[key][vectorSet][i];

					// convert back to 8x8
					checkSquare = self.to8(checkSquare);
					if(board.squares[checkSquare]) {
						if(board.squares[checkSquare].pieceType === key)
							attackCount++;
						break;
					}
				};
			};
		}
	}

	return attackCount;
}

ChessBoard.prototype.parseFEN = function(fen) {
	var board = this.clearBoard();

	if(!fen){
		return;
	}

	// separate the various fen data points
	var FENData = fen.split(' ');

	// get the piece data
	var pieceArrangement = FENData[0];
	var pieceData = pieceArrangement.split('/');
	var piece;
	var boardPosition = 63;

	var offset;
	// loop over all the board squares and check if
	// they have a piece on them in the fen piece data
	for(var i = 0; i < 8; i++)
	{
		offset = 0;
		for(var j = 0; j < 8; j++)
		{
			// no pieces are represented by the number of empty squares
			if(this.isNumber(pieceData[i][7-j]))
			{
				offset = parseInt(pieceData[i][7-j]);
				boardPosition -= offset;
				continue;
			}
			else if(pieceData[i][7-j])
			{
				// match the fen syntax with the map
				if(this.getFENsymbol(pieceData[i][7-j])) {
					board.squares[boardPosition] = this.getFENsymbol(pieceData[i][7-j]);
					boardPosition--;
				}
			}
		}
	}

	// map the rest of the fen data
	board.toMove = FENData[1];
	board.wCastleKingside = FENData[2].match(/K/).length > 0;
	board.wCastleQueenside = FENData[2].match(/Q/).length > 0;
	board.bCastleKingside = FENData[2].match(/k/).length > 0;
	board.bCastleQueenside = FENData[2].match(/q/).length > 0;
	board.enPassant = FENData[3] === '-' ? undefined : FENData[3];
	board.plyCount = FENData[4] || 0;
	board.moveNumber = FENData[4] || 0;

	return board;
};

ChessBoard.prototype.isNumber = function(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

// displays the board in the console
ChessBoard.prototype.displayBoard = function(board) {
	//this.flip = true;
	board = board || this.board;
	console.info('');
	console.info('-----------------------------------------------------------------');

	var i,j,s;
	if(this.flip)
	{
		i = 7;
		j = 0;
		while( i < 64) {
			s = [];
			j = 0;

			while(j < 8)
			{
				if(board.squares[i-j])
					s.push(board.squares[i-j].pieceType);
				else
					s.push(i-j);

				j++;
			}
			console.info((i+1)/8 + '\t' + s.join('\t|\t') + '\t|');
			i+=8;
			console.info('-----------------------------------------------------------------');
		};
	}
	else
	{
		i = 56;
		j = 0;
		while( i >= 0 ) {
			s = [];
			j = 0;

			while(j < 8) {
				if(board.squares[i+j])
					s.push(board.squares[i+j].pieceType);
				else
					s.push(i+j);

				j++;
			}

			console.info((i+8)/8 + '\t' + s.join('\t|\t') + '\t|');
			i-=8;
			console.info('-----------------------------------------------------------------');
		}
	}

	if(this.flip)
		console.info('\th\t|\tg\t|\tf\t|\te\t|\td\t|\tc\t|\tb\t|\ta\t|');
	else
		console.info('\ta\t|\tb\t|\tc\t|\td\t|\te\t|\tf\t|\tg\t|\th\t|');
	console.info('');
};

ChessBoard.prototype.getFENsymbol = function(a) {
	var piece;
	switch(a) {
		case 'r': {piece = {pieceType: '♜', owner: 'b', diagram: 'r', blackSquare: 't'};} break;
		case 'n': {piece = {pieceType: '♞', owner: 'b', diagram: 'n', blackSquare: 's'};} break;
		case 'b': {piece = {pieceType: '♝', owner: 'b', diagram: 'l', blackSquare: 'v'};} break;
		case 'q': {piece = {pieceType: '♛', owner: 'b', diagram: 'q', blackSquare: 'w'};} break;
		case 'k': {piece = {pieceType: '♚', owner: 'b', diagram: 'k', blackSquare: 'm'};} break;
		case 'p': {piece = {pieceType: '♟', owner: 'b', diagram: 'p', blackSquare: 'z'};} break;
		case 'R': {piece = {pieceType: '♖', owner: 'w', diagram: 'R', blackSquare: 't'};} break;
		case 'N': {piece = {pieceType: '♘', owner: 'w', diagram: 'N', blackSquare: 's'};} break;
		case 'B': {piece = {pieceType: '♗', owner: 'w', diagram: 'L', blackSquare: 'v'};} break;
		case 'Q': {piece = {pieceType: '♕', owner: 'w', diagram: 'Q', blackSquare: 'w'};} break;
		case 'K': {piece = {pieceType: '♔', owner: 'w', diagram: 'K', blackSquare: 'm'};} break;
		case 'P': {piece = {pieceType: '♙', owner: 'w', diagram: 'P', blackSquare: 'z'};} break;
		default: piece = undefined;
	}

	return piece;
};

ChessBoard.prototype.clearBoard = function() {
	return {
		squares: [
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, // h1-a1
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, // h2-a2
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, // h3-a3
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, // h4-a4
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, // h5-a5
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, // h6-a6
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, // h7-a7
			undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined  // h8-a8
		],
		wCastleKingside: false,
		wCastleQueenside: false,
		bCastleKingside: false,
		bCastleQueenside: false,
		enPassant: undefined,
		toMove: 'w',
		plyCount: 0,
		moveNumber: 0
	};
};

ChessBoard.prototype.algebraicMap = [
	'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
	'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
	'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
	'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
	'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
	'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
	'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
	'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8'
];

ChessBoard.prototype.squareMap = {
	a1: 0, b1: 1, c1: 2, d1: 3, e1: 4, f1: 5, g1: 6, h1: 7,
	a2: 8, b2: 9, c2: 10, d2: 11, e2: 12, f2: 13, g2: 14, h2: 15,
	a3: 16, b3: 17, c3: 18, d3: 19, e3: 20, f3: 21, g3: 22, h3: 23,
	a4: 24, b4: 25, c4: 26, d4: 27, e4: 28, f4: 29, g4: 30, h4: 31,
	a5: 32, b5: 33, c5: 34, d5: 35, e5: 36, f5: 37, g5: 38, h5: 39,
	a6: 40, b6: 41, c6: 42, d6: 43, e6: 44, f6: 45, g6: 46, h6: 47,
	a7: 48, b7: 49, c7: 50, d7: 51, e7: 52, f7: 53, g7: 54, h7: 55,
	a8: 56, b8: 57, c8: 58, d8: 59, e8: 60, f8: 61, g8: 62, h8: 63
};

ChessBoard.prototype.pieceVector = {
	b: {
		// black rook
		'♜': [[-15,-30,-45,-60,-75,-90,-105],[1,2,3,4,5,6,7],[15, 30, 45,60,75,90,105],[-1,-2,-3,-4,-5,-6,-7]],
		// black knight
		'♞': [-31,-29,-17,-13,13,17,29,31],
		// black bishop
		'♝': [[-16,-32,-48,-64,-80,-96, -112],[16,32,48,64,80,96,112],[14,28,42,56,70,84,98],[-14,-28,-42,-56,-70,-84,-98]],
		// black queen
		'♛': [[-15,-30,-45,-60,-75,-90,-105],[1,2,3,4,5,6,7],[15, 30, 45,60,75,90,105],[-1,-2,-3,-4,-5,-6,-7],[-16,-32,-48,-64,-80,-96,-112],[16,32,48,64,80,96,112],[14,28,42,56,70,84,98],[-14,-28,-42,-56,-70,-84,-98]],
		// black king
		'♚': [[-16,-15,-14,-1,1,14,15,16],[-2, 2]],
		// black pawn
		'♟': [[-15,-30], [-14,-16]]
	},
	w: {
		// white rook
		'♖': [[-15,-30,-45,-60,-75,-90,-105],[1,2,3,4,5,6,7],[15, 30, 45,60,75,90,105],[-1,-2,-3,-4,-5,-6,-7]],
		// white knight
		'♘': [-31,-29,-17,-13,13,17,29,31],
		// white bishop
		'♗': [[-16,-32,-48,-64,-80,-96, -112],[16,32,48,64,80,96,112],[14,28,42,56,70,84,98],[-14,-28,-42,-56,-70,-84,-98]],
		// white queen
		'♕': [[-15,-30,-45,-60,-75,-90,-105],[1,2,3,4,5,6,7],[15, 30, 45,60,75,90,105],[-1,-2,-3,-4,-5,-6,-7],[-16,-32,-48,-64,-80,-96,-112],[16,32,48,64,80,96,112],[14,28,42,56,70,84,98],[-14,-28,-42,-56,-70,-84,-98]],
		// white king
		'♔': [[-16,-15,-14,-1,1,14,15,16],[-2, 2]],
		// white pawn
		'♙': [[15,30], [14,16]]
	}
};