var ChessBoard = (function($) {

	var chess_board = function() {
		this.board = this.clearBoard();
	};

	chess_board.prototype.specialCases = { castleRights: undefined, enpassant: undefined };

	chess_board.prototype.init = function(fen) {
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
	chess_board.prototype.setMoves = function(rMoves, sPosition) {
		this.startingPosition = this.parseFEN(sPosition);
		this.currentPosition = JSON.parse(JSON.stringify(this.startingPosition));
		this.moves = this.validate_moves(rMoves);
		this.currentMove = -1;
	};

	chess_board.prototype.nextMove = function() {
		var type = typeof this.currentMove;

		if(type === 'string') {
			var address = this.currentMove.split('.');
			var move = parseInt(address.pop());
			address.push(move+1);
			return this.jumpToMove(address.join('.'));
		}
		else {
			return this.jumpToMove(this.currentMove+1);
		}
	};

	chess_board.prototype.prevMove = function() {
		var type = typeof this.currentMove;
		if(type === 'string') {
			var address = this.currentMove.split('.');
			var move = parseInt(address.pop());
			address.push(move-1);
			return this.jumpToMove(address.join('.'));
		}
		else {
			return this.jumpToMove(this.currentMove-1);
		}
	};

	chess_board.prototype.jumpToMove = function(move) {
		if(typeof move === 'string') {
			var m = this.getComplexMove(move);
			if(m) {
				if(m.error !== undefined) {
					alert(m.error)
				}
				else {
					this.currentMove = m.address;
					this.currentPosition = m.board;
					this.currentMoveObject = m;
				}
			}
			else {
				return false;
			}
		}
		else {

			if(move < 0) {
				this.currentMove = -1;
				this.currentPosition = this.startingPosition;
				this.currentMoveObject = {};
			}
			
			else if(move >= this.moves.length) {
				this.currentMove = this.moves.length-1;
				this.currentPosition = this.moves[this.currentMove].board;
				this.currentMoveObject = this.moves[this.currentMove];
			}
			else {
				this.currentMove = move;
				this.currentPosition = this.moves[this.currentMove].board;
				this.currentMoveObject = this.moves[this.currentMove];
			}

			if(this.currentMoveObject.error !== undefined) {
				alert(this.currentMoveObject.error);
				return undefined;
			}
		}

		return this.currentMoveObject;
	};

	chess_board.prototype.getComplexMove = function(move) {
		var self = this;
		var type = typeof move;

		if(type === 'string') {
			if(move === '-1') {
				return { board: this.startingPosition };
			}

			if(move.split('.').length === 1) {
				return this.jumpToMove(parseInt(move));
			}

			var getMove = function(rMoves, m) {
				var address = m.split('.');
				var moveNumber = parseInt(address.shift());
				var variationNumber = parseInt(address.shift()-1);
				var variationMove = parseInt(address.shift());

				if(variationMove === -1) {
					return rMoves[moveNumber-1];
				}
				if(address.length > 0) {
					address.unshift(variationMove);
					return getMove(rMoves[moveNumber].variations[variationNumber], address.join('.'));
				}
				else {
					if(variationMove !== -1 && variationMove < rMoves[moveNumber].variations[variationNumber].length) {
						return rMoves[moveNumber].variations[variationNumber][variationMove];
					}
					else {
						return false;
					}
				}
			}

			return getMove(this.moves, move);
		}

		if(type === 'number') {
			return this.moves[move];
		}
	};

	chess_board.moveRegex = /(?:(?:([PNBRQK])?([a-h]?[1-8]?)?(x)?([a-h][1-8])(?:\=([PNBRQ]))?)|(O(?:-?O){1,2})[\+#]?)/gi;
	chess_board.prototype.validate_moves = function(rMoves, board) {
		if(rMoves) {
			var algebraic;
			var validMove;
			var board = JSON.parse(JSON.stringify(board || this.startingPosition));
			for (var i = 0; i < rMoves.length; i++) {
				rMoves[i].algebraic.replace(chess_board.moveRegex, $.proxy(function() { 
					algebraic = {
						fullText: arguments[0],
						piece: arguments[1],
						indicator: arguments[2],
						isCapture: arguments[3] === 'x',
						finalSquare: arguments[4],
						promotionPiece: arguments[5],
						castle: arguments[6],
						check: arguments[7],
						player: rMoves[i].player
					};
					try {
						validMove = this.checkMove(algebraic, board, rMoves[i]);

						if(validMove) {
							board = validMove.board;
							board.plyCount = rMoves[i].plyCount;
							board.moveNumber = rMoves[i].moveNumber;

							rMoves[i].origin = validMove.origin;
							rMoves[i].destination = validMove.destination;
							rMoves[i].smith = validMove.smith;
							rMoves[i].board = JSON.parse(JSON.stringify(validMove.board));
							rMoves[i].fen = this.convertBoardToFEN(board);

							if(rMoves[i].variations.length > 0) {
								var prevBoard = rMoves[i-1] === undefined ? this.startingPosition : rMoves[i-1].board;
								for (var j = 0; j < rMoves[i].variations.length; j++) {
									rMoves[i].variations[j] = this.validate_moves(rMoves[i].variations[j], prevBoard);
								};
							}
						}
						else {
							throw('INVALID MOVE: the move \'' + rMoves[i].fullText + '\' is illegal.');
						}
					}
					catch(err) {
						rMoves[i].error = err;
					}

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
		done: check, promotion, captures, en passant, castling, normal moves
	*/
	chess_board.prototype.checkMove = function(oMove, board, originalMove) {
		if(!oMove || !board ) {
			return { fen: undefined, smith: undefined, board: board };
		}

		var self = this;

		oMove.piece = (oMove.piece || 'p').toLowerCase();
		oMove.player = (oMove.player || 'w').toLowerCase();
		isWhite = oMove.player === 'w';

		if(oMove.castle) {
			oMove.castle = oMove.castle.toLowerCase();
		}

		// if the move is a castle
		if(oMove.castle !== undefined && oMove.castle !== null && oMove.castle !== '')
		{
			var originalKingSquare = isWhite ? chess_board.squareMap['e1'] : chess_board.squareMap['e8'];
			var originalRookSquare;
			var finalKingSquare;
			var finalRookSquare;
			var checkSquares;

			oMove.castle = oMove.castle.toLowerCase();

			// castled queenside
			if(oMove.castle === 'o-o-o' || oMove.castle === '0-0-0')
			{
				// verify the player has castle rights
				if(isWhite && !board.wCastleQueenside) {
					throw('INVALID MOVE: On move ' + originalMove.moveNumber + ' white does not have privledges to castle queenside.');
				}
				else if(!isWhite && !board.bCastleQueenside) {
					throw('INVALID MOVE: On move ' + originalMove.moveNumber + ' black does not have privledges to castle queenside.');
				}

				// set the required squares
				originalRookSquare = isWhite ? chess_board.squareMap['a1'] : chess_board.squareMap['a8'];
				finalKingSquare = isWhite ? chess_board.squareMap['c1'] : chess_board.squareMap['c8'];
				finalRookSquare = isWhite ? chess_board.squareMap['d1'] : chess_board.squareMap['d8'];
				checkSquares = isWhite 
					? [chess_board.squareMap['c1'], chess_board.squareMap['d1'], chess_board.squareMap['e1']] 
					: [chess_board.squareMap['c8'], chess_board.squareMap['d8'], chess_board.squareMap['e8']];
			}

			// castled kingside
			else if(oMove.castle === 'o-o' || oMove.castle === '0-0')
			{
				// verify the player has castle rights
				if(isWhite && !board.wCastleKingside) {
					throw('INVALID MOVE: On move ' + originalMove.moveNumber + ' white does not have privledges to castle kingside.');
				}
				else if(!isWhite && !board.bCastleKingside) {
					throw('INVALID MOVE: On move ' + originalMove.moveNumber + ' black does not have privledges to castle kingside.');
				}

				// set the required squares
				originalRookSquare = isWhite ? chess_board.squareMap['h1'] : chess_board.squareMap['h8'];
				finalRookSquare = isWhite ? chess_board.squareMap['f1'] : chess_board.squareMap['f8'];
				finalKingSquare = isWhite ? chess_board.squareMap['g1'] : chess_board.squareMap['g8'];
				checkSquares = isWhite 
					? [chess_board.squareMap['e1'],chess_board.squareMap['f1'],chess_board.squareMap['g1']] 
					: [chess_board.squareMap['e8'],chess_board.squareMap['f8'],chess_board.squareMap['g8']];
			}

			var throughCheck = false;

			for (var i = 0; i < checkSquares.length; i++) {
				if(this.isUnderAttack(checkSquares[i], board, oMove.player)) {
					throughCheck = true;
					break;
				}
			};

			if(throughCheck) {
				throw('INVALID MOVE:  On move ' + originalMove.moveNumber + (isWhite ? 'white' : 'black') + ' cannot castle through, into, or while in check.');
			}

			board = this.movePiece(originalKingSquare, finalKingSquare, board);
			board = this.movePiece(originalRookSquare, finalRookSquare, board);

			if(isWhite) { // remove castling rights since white caslted
				board.wCastleKingside = false;
				board.wCastleQueenside = false;
			}
			else { // remove castling rights since black caslted
				board.bCastleKingside = false;
				board.bCastleQueenside = false;
			}
		}

		// the move was not castling
		else
		{
			var possibleSquares = [];
			var defaultSquareNumber = chess_board.squareMap[oMove.finalSquare];
			var square = this.to15(defaultSquareNumber); // convert to 15x15 grid

			var originSquare;
			var vectors;
			var comparePiece;

			var calculatePossibleOrigins = function(piece, vectorSet, cannotJump) {
				var poss = [];
				var os;

				for (var i = 0; i < vectorSet.length; i++) {
					// pawns can only move one square on the first move
					if(piece === '♙' && !oMove.isCapture && i === 1 && Math.floor((square - vectorSet[i])/15) !== 1) {
						break;
					}

					// pawns can only move one square on the first move
					if(piece === '♟' && !oMove.isCapture && i === 1 && Math.floor((square - vectorSet[i])/15) !== 6) {
						break;
					}

					// calculate the origin square
					os = self.to8(square - vectorSet[i]);

					if(board.squares[os]) {
						// verify the origin square contains the correct piece type
						if(board.squares[os].pieceType === piece)
							// if os, add it to the list of possible squares
							poss.push(os);
						else {
							// if jumping is not allowed, do not continue
							if(cannotJump)
								break;
						}
					}
				};
				return poss;
			};

			// check pawn moves
			if (oMove.piece === 'p'){
				comparePiece = isWhite ? '♙' : '♟';
				possibleSquares = calculatePossibleOrigins(comparePiece, chess_board.pieceVector[oMove.player][comparePiece][oMove.isCapture ? 1 : 0], !oMove.isCapture);
			}
			else if(oMove.piece === 'k') {
				comparePiece = isWhite ? '♔' : '♚';
				possibleSquares = calculatePossibleOrigins(comparePiece, chess_board.pieceVector[oMove.player][comparePiece][0]);

				if(isWhite) {  // remove white's castling rights because king moved
					board.wCastleKingside = false;
					board.wCastleQueenside = false;
				}
				else { // remove black's castling rights because because king moved
					board.bCastleKingside = false;
					board.bCastleQueenside = false;
				}
			}
			else {
				if(oMove.piece === 'n') { // knight moves
					comparePiece = isWhite ? '♘' : '♞';
					possibleSquares = calculatePossibleOrigins(comparePiece, chess_board.pieceVector[oMove.player][comparePiece]);
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

					for (var set = 0; set < chess_board.pieceVector[oMove.player][comparePiece].length; set++) {
						possibleSquares = possibleSquares.concat(calculatePossibleOrigins(comparePiece, chess_board.pieceVector[oMove.player][comparePiece][set], true));
					};
				}
			}

			var startSquare;
			var endSquare = defaultSquareNumber;
			var matches = [];

			if(possibleSquares.length > 0)
			{
				possibleSquares = possibleSquares.filter(function(elem, pos) {
					return possibleSquares.indexOf(elem) === pos;
				});

				if(possibleSquares.length === 1) {
					startSquare = possibleSquares[0];
				}
				else if(oMove.indicator) {
					for (var i = 0; i < possibleSquares.length; i++) {
						if((chess_board.algebraicMap[possibleSquares[i]].match(new RegExp(oMove.indicator)) || []).length === 1)
						{
							matches.push(possibleSquares[i]);
						}
					};

					if(matches.length === 0) {
						throw ('INVALID MOVE: On move ' + originalMove.moveNumber + ' for ' + (isWhite ? 'white' : 'black') + ' there are no ' + comparePiece + '\'s that can move to ' + chess_board.algebraicMap[endSquare]);
					}
					else if(matches.length === 1) {
						startSquare = matches[0]
					}
					else {
						throw('AMBIGUOUS MOVE (underspecific indicator): On move ' + originalMove.moveNumber + ' for ' + (isWhite ? 'white' : 'black') + ' there are two or more pieces that can move to ' + chess_board.algebraicMap[endSquare])
					}
				}
				else {
					throw('AMBIGUOUS MOVE (no indicator): On move ' + originalMove.moveNumber + ' for ' + (isWhite ? 'white' : 'black') + ' there are two or more pieces that can move to ' + chess_board.algebraicMap[endSquare])
				}
			}
			else {
				if(oMove.piece === 'b') {
					oMove.piece = 'p';
					return this.checkMove(oMove, board, originalMove);
				}

				// console.info(oMove);
				// this.displayBoard(board, this.to8(this.to15(endSquare) + 16));
				throw ('INVALID MOVE: On move ' + originalMove.moveNumber + ' for ' + (isWhite ? 'white' : 'black') + ' there are no ' + comparePiece + '\'s that can move to ' + chess_board.algebraicMap[endSquare]);
			}


			if(oMove.isCapture) {
				if(board.squares[endSquare] === undefined || board.squares[endSquare] === null) {
					// check white en passant
					if(comparePiece === '♙' && board.enPassant === chess_board.algebraicMap[endSquare] && (board.squares[endSquare-8] !== undefined && board.squares[endSquare-8] !== null)) {
						oMove.captured = board.squares[endSquare-8]; // set the captured piece
						board.squares[endSquare-8] = undefined; // remove the captured pawn
					}

					// check black en passant
					else if(comparePiece === '♟' && board.enPassant === chess_board.algebraicMap[endSquare] && (board.squares[endSquare+8] !== undefined && board.squares[endSquare+8] !== null)) {
						oMove.captured = board.squares[endSquare+8]; // set the captured piece
						board.squares[endSquare+8] = undefined; // remove the captured pawn
					}
				}
				else {
					oMove.captured = board.squares[endSquare]; // set the captured piece
				}

				if(oMove.captured === undefined) {
					console.info(oMove.fullText, 'no piece to capture') // alert there is no piece to capture
				}
			}

			if(comparePiece === '♙' && endSquare - startSquare === 16) {
				// allow en passant on the next move
				board.enPassant = chess_board.algebraicMap[startSquare+8];
			}
			else if(comparePiece === '♟' && endSquare - startSquare === -16) {
				// allow en passant on the next move
				board.enPassant = chess_board.algebraicMap[startSquare-8];
			}
			else {
				// disallow en passant on the next move
				board.enPassant = '-';
			}

			// check for piece promotion
			var promotionPiece;
			if((oMove.promotionPiece !== undefined && oMove.promotionPiece !== null) && oMove.piece === 'p' && (oMove.promotionPiece.match(/q|r|n|b/i) || []).length === 1) {
				promotionPiece = isWhite ? oMove.promotionPiece.toUpperCase() : oMove.promotionPiece.toLowerCase();
				promotionPiece = this.getFENsymbol(promotionPiece);
			}
			
			// move the pieces
			board = this.movePiece(startSquare, endSquare, board, promotionPiece);

			var kingsquare = board.squares.searchByProperty('pieceType', isWhite ? '♔' : '♚');

			if(this.isUnderAttack(kingsquare, board, oMove.player) > 0) {
				throw('INVALID MOVE: On move ' + originalMove.moveNumber + '  ' + (isWhite ? 'white' : 'black') +' has moved into or failed to move out of check.');
			}
		}

		return { fen: undefined, smith: oMove.fullText, board: board, origin: startSquare, destination: endSquare };
	};


	// this method will convert a board object into its string representation, FEN
	chess_board.prototype.convertBoardToFEN = function(board) {
		// since the fen is written left to right up to down,
		// and the board array is written right to left up to down,
		// some loop trickery is needed to iterate over all the squares
		// by starting at 56 and going down 8 every time, going
		// down 8 ranks, stopping after 0, is possible
		// by loooping from 0 to 7, and adding to the rank loop,
		// access every square going left to right is granted

		var fen = [];
		var pieces = [];
		var i = 56;
		var j = 0;
		var emptyCount = 0;
		var rankText = [];
		var castleRights = '';

		while(i >= 0) { // loop over all the board squares
			rankText = [];
			j = 0;

			while(j < 8) { // loop over all the squares in this rank
				if(board.squares[i+j] === undefined || board.squares[i+j] === null) {
					// if the square is empty
					emptyCount++;
				}
				else { // if the square is not empty
					if(emptyCount !== 0) { // if the square isn't empty but there are empty squares before it
						rankText.push(emptyCount);
						emptyCount = 0;
					}

					// add the fen representation of the piece
					rankText.push(board.squares[i+j].fen);
				}

				// next square
				j++;
			}

			if(emptyCount !== 0) {
				// if there are empty squares at the end of the rank
				rankText.push(emptyCount);
				emptyCount = 0;
			}

			// add the rank to the piece array
			pieces.push(rankText.join(''));

			// next rank
			i-=8;
		}

		fen.push(pieces.join('/')); // apply all the piece placements
		fen.push(board.toMove); // set whose move it is

		// determine castling rights
		castleRights += board.wCastleKingside ? 'K' : '';
		castleRights += board.wCastleQueenside ? 'Q' : '';
		castleRights += board.bCastleKingside ? 'k' : '';
		castleRights += board.bCastleQueenside ? 'q' : '';


		// apply additional details to fen
		fen.push(castleRights === '' ? '-' : castleRights);
		fen.push(board.enPassant || '-');
		fen.push(board.moveNumber || 0);
		fen.push(board.plyCount || 0);

		// return the fen
		return fen.join(' ');
	}

	chess_board.prototype.movePiece = function(start, end, board, promotionPiece) {
		if(start === undefined || end === undefined || board === undefined || board.squares === undefined) {
			this.displayBoard(board);
			//console.info('start', start, 'end', end, 'board', board)
			throw('not enough info to move a piece start: ' + start + ', end: ' + end);
		}

		if(board.squares[start]) {
			// promote the piece if necessary
			board.squares[end] = (promotionPiece === undefined || promotionPiece === null) ? board.squares[start] : promotionPiece;
			board.squares[start] = undefined;
		}
		else {
			throw('no piece found');
		}

		return board;
	}

	// convert to 15x15 grid
	chess_board.prototype.to15 = function(num) {
		return Math.floor(num/8)*15+num%8;
	}

	chess_board.array8to15 = [
		0,1,2,3,4,5,6,7,
		15, 16, 17, 18, 19, 20, 21, 22,
		30, 31, 32, 33, 34, 35, 36, 37,
		45, 46, 47, 48, 49, 50, 51, 52,
		60, 61, 62, 63, 64, 65, 66, 67,
		75, 76, 77, 78, 79, 80, 81, 82,
		90, 91, 92, 93, 94, 95, 96, 97,
		105, 106, 107, 108, 109, 110, 111, 112
	];
	// convert to 8x8 grid
	chess_board.prototype.to8 = function(num) {
		if(chess_board.array8to15.indexOf(num) === -1) {
			return undefined;
		}

		return Math.floor(num/15)*8+num%15;
	}

	// check if a square is under attack
	chess_board.prototype.isUnderAttack = function(square, board, player) {
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

		var vectors = chess_board.pieceVector[player === 'w' ? 'b' : 'w'];
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
						if(board.squares[checkSquare] !== undefined && board.squares[checkSquare] !== null) {
							if(board.squares[checkSquare].pieceType === key) {
								attackCount++;
							}
							break;
						}
					};
				};
			}
		}

		return attackCount;
	}

	chess_board.prototype.parseFEN = function(fen) {
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
		board.wCastleKingside = (FENData[2].match(/K/) || []).length > 0;
		board.wCastleQueenside = (FENData[2].match(/Q/) || []).length > 0;
		board.bCastleKingside = (FENData[2].match(/k/) || []).length > 0;
		board.bCastleQueenside = (FENData[2].match(/q/) || []).length > 0;
		board.enPassant = FENData[3] === '-' ? undefined : FENData[3];
		board.plyCount = FENData[4] || 0;
		board.moveNumber = FENData[4] || 0;

		return board;
	};

	chess_board.prototype.isNumber = function(n) {
		return !isNaN(parseFloat(n)) && isFinite(n);
	}

	// displays the board in the console
	chess_board.prototype.displayBoard = function(board, move) {
		if(typeof board === 'string') {
			board = this.parseFEN(board);
		}
		board = board || this.board;
		console.info(move || '');
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

	chess_board.prototype.getFENsymbol = function(a) {
		var piece;
		switch(a) {
			case 'r': case '♜': {piece = {fen: 'r', pieceType: '♜', owner: 'b', diagram: 'r', blackSquare: 't'};} break;
			case 'n': case '♞': {piece = {fen: 'n', pieceType: '♞', owner: 'b', diagram: 'n', blackSquare: 's'};} break;
			case 'b': case '♝': {piece = {fen: 'b', pieceType: '♝', owner: 'b', diagram: 'l', blackSquare: 'v'};} break;
			case 'q': case '♛': {piece = {fen: 'q', pieceType: '♛', owner: 'b', diagram: 'q', blackSquare: 'w'};} break;
			case 'k': case '♚': {piece = {fen: 'k', pieceType: '♚', owner: 'b', diagram: 'k', blackSquare: 'm'};} break;
			case 'p': case '♟': {piece = {fen: 'p', pieceType: '♟', owner: 'b', diagram: 'p', blackSquare: 'z'};} break;
			case 'R': case '♖': {piece = {fen: 'R', pieceType: '♖', owner: 'w', diagram: 'R', blackSquare: 't'};} break;
			case 'N': case '♘': {piece = {fen: 'N', pieceType: '♘', owner: 'w', diagram: 'N', blackSquare: 's'};} break;
			case 'B': case '♗': {piece = {fen: 'B', pieceType: '♗', owner: 'w', diagram: 'L', blackSquare: 'v'};} break;
			case 'Q': case '♕': {piece = {fen: 'Q', pieceType: '♕', owner: 'w', diagram: 'Q', blackSquare: 'w'};} break;
			case 'K': case '♔': {piece = {fen: 'K', pieceType: '♔', owner: 'w', diagram: 'K', blackSquare: 'm'};} break;
			case 'P': case '♙': {piece = {fen: 'P', pieceType: '♙', owner: 'w', diagram: 'P', blackSquare: 'z'};} break;
			default: piece = undefined;
		}

		return piece;
	};

	chess_board.prototype.clearBoard = function() {
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

	chess_board.algebraicMap = [
		'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
		'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
		'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
		'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
		'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
		'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
		'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
		'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8'
	];

	chess_board.squareMap = {
		a1: 0, b1: 1, c1: 2, d1: 3, e1: 4, f1: 5, g1: 6, h1: 7,
		a2: 8, b2: 9, c2: 10, d2: 11, e2: 12, f2: 13, g2: 14, h2: 15,
		a3: 16, b3: 17, c3: 18, d3: 19, e3: 20, f3: 21, g3: 22, h3: 23,
		a4: 24, b4: 25, c4: 26, d4: 27, e4: 28, f4: 29, g4: 30, h4: 31,
		a5: 32, b5: 33, c5: 34, d5: 35, e5: 36, f5: 37, g5: 38, h5: 39,
		a6: 40, b6: 41, c6: 42, d6: 43, e6: 44, f6: 45, g6: 46, h6: 47,
		a7: 48, b7: 49, c7: 50, d7: 51, e7: 52, f7: 53, g7: 54, h7: 55,
		a8: 56, b8: 57, c8: 58, d8: 59, e8: 60, f8: 61, g8: 62, h8: 63
	};

	chess_board.pieceVector = {
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
			'♖': [[-15,-30,-45,-60,-75,-90,-105],[1,2,3,4,5,6,7],[15,30,45,60,75,90,105],[-1,-2,-3,-4,-5,-6,-7]],
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

	return chess_board;

})(jquery_1_10_1);