var pgnViewer = (function($) {

	var pgnViewerModule = function(moduleId) {
		if(moduleId) {
			this.init(moduleId);
		}
	}

	pgnViewerModule.prototype = new Module();

	pgnViewerModule.prototype.elementMap = {
		'container': 'div.container',
		'notationWrapper': 'div.notationWrapper',
		'notation' : 'div.notationWindow',
		'board' : 'div.board',
		'backward': '[data-clickaction="prevMove"], [data-clickaction="start"]',
		'forward': '[data-clickaction="nextMove"], [data-clickaction="end"]',
		'clickMove': '[data-clickaction="clickMove"]',
		'comments': 'div.comments',
		'fenInput': 'input[name="fen"]',
		'details': 'div.details',
		'svg': 'div.svg',
		'play': 'button[data-clickaction="play"]'
	}

	pgnViewerModule.prototype.initModule = function () {
		var pgnViewerClass = 'pgnViewer';

		if(!this.$module.hasClass(pgnViewerClass))
		{
			this.$module.addClass(pgnViewerClass);
		}

		this.startingFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

		// generate the useful local variables
		this.pgns = [];
		this.currentGame;
		this.currentPosition = [];
		this.flip = false;
		this.hideAnnotations = false;

		// fire this method after the module has been built
		var moduleCallback = function() {
			// load the first game
			this.loadGame(0);

			// set the starting position
			this.updateBoard(this.chessBoard.startingPosition);
			this.windowResized();
		};

		// build the module
		this.buildModule($.proxy(moduleCallback, this));

		//this.windowResized();
		window.addEventListener("resize", $.proxy(this.windowResized, this));
	}

	pgnViewerModule.prototype.windowResized = function(e) {
		var width = this.$el('board').width();
		this.$el('board').height(width);
		this.$el('notationWrapper').height(width - 10);
	}

	// download the current game
	// TO DO: convert to be a display so the user can copy the pgn
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
	}

	// allow for keyboard interaction
	pgnViewerModule.prototype.action_handleKeyDown = function($el, val, e) {
		switch(e.keyCode) {
			case 37: { this.stop(); return this.loadPrevMove(); } // left arrow
			case 39: { this.stop(); return this.loadNextMove(); } // right arrow
			default: return;
		}
	}

	// show/hide annotations
	pgnViewerModule.prototype.action_toggleAnnotations = function($el, val, e) {
		this.hideAnnotations = val;
	}

	// load a selected game
	pgnViewerModule.prototype.action_loadGame = function($el, val, e) {
		this.stop();
		this.loadGame(val);
	}

	// flip the chessboard
	pgnViewerModule.prototype.action_flip = function($el, val, e) {
		this.chessBoard.flip = !this.chessBoard.flip;
		this.updateBoard();
	}

	// load in the next move
	pgnViewerModule.prototype.action_nextMove = function($el, val, e) {
		this.stop();
		this.loadNextMove();
	}

	// load the previous move
	pgnViewerModule.prototype.action_prevMove = function($el, val, e) {
		this.stop();
		this.loadPrevMove();
	}

	// handle the pressing of the play button
	pgnViewerModule.prototype.action_play = function($el, val, e) {
		this.play();
	}

	// move 
	pgnViewerModule.prototype.play = function() {
		if(this.playInterval)
		{
			this.stop();
		}
		else
		{
			this.loadNextMove();
			this.playInterval = setInterval($.proxy(this.loadNextMove, this), 1000);
			this.$el('play').text('stop');
		}
	}

	pgnViewerModule.prototype.stop = function() {
		if(this.playInterval)
		{
			clearInterval(this.playInterval);
			this.$el('play').text('play');
			delete this.playInterval;
		}
	}

	// jump to the beginning of the game
	pgnViewerModule.prototype.action_start = function($el, val, e) {
		var move = this.chessBoard.jumpToMove(-1);
		this.stop();

		if(move) {
			this.updateBoard();
		}
	};

	// jump to the end of a move
	pgnViewerModule.prototype.action_end = function($el, val, e) {
		var move = this.chessBoard.jumpToMove(this.chessBoard.moves.length-1);
		this.stop();

		if(move) {
			this.updateBoard();
		}
	};

	// jump to a particular move 
	pgnViewerModule.prototype.action_clickMove = function($el, val, e) {
		var move = this.chessBoard.jumpToMove(val);
		this.stop();

		if(move) {
			this.updateBoard();
		}
	};

	// select everything within the input/textarea
	pgnViewerModule.prototype.action_selectAll = function($el, val, e) {
		$el[0].setSelectionRange(0, $el.val().length);
	}

	// load the next move
	pgnViewerModule.prototype.loadNextMove = function() {
		var move = this.chessBoard.nextMove();

		if(move) {
			this.updateBoard();
		}
	};

	// load the previous move
	pgnViewerModule.prototype.loadPrevMove = function() {
		var move = this.chessBoard.prevMove();

		if(move) {
			this.updateBoard();
		}
	};

	// Get the pgn data and when it is loaded, build the GUI
	pgnViewerModule.prototype.buildModule = function(callback) {
		// method that will build the gui
		var buildModule = function() {
			var $container = $('<div class="container" data-keydownaction="handleKeyDown" tabindex="0"></div>');
			var $pgnSelect = $('<select data-changeaction="loadGame">');
			var $details = $('<div class="details"></div>')
			var $boardWrapper = $('<div class="boardWrapper"></div>');
			var $board = $('<div class="board"></div>');
			var $notationWrapper = $('<div class="notationWrapper"></div>');
			var $notationWindow = $('<div class="notationWindow"></div>');
			var $comments = $('<div class="comments"></div>');
			var $additionalControls = this.buildAdditionalControls();
			var $controls = this.buildControls();

			// draw the basic starting position
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


			var pgn;
			for (var i = 0; i < this.pgns.length; i++) {
				pgn = this.pgns[i];
				$pgnSelect.append($('<option value="' + i + '">' + pgn.white + ' - ' + pgn.black + ' (' + pgn.round + ')</option>'))
			};

			$board.html(b.join('<br />\r\n'));
			$boardWrapper.append($board, $controls);
			$notationWrapper.append($additionalControls, $notationWindow, $comments);

			// if there are multiple games, add the select box to the gui
			if(this.pgns.length > 1) {
				$container.append($pgnSelect);
			}

			$container.append($details, $boardWrapper, $notationWrapper);
			this.$module.append($container);

			// fire the call back
			callback();
		}

		// load in the PGNs from the dom
		this.loadPGNs($.proxy(buildModule, this));
	};

	pgnViewerModule.prototype.buildControls = function() {
		var $c = $('<div class="controls"></div>');

		$c.append($('<button class="not-mobile" data-clickaction="start">start</button>'));
		$c.append($('<button data-clickaction="prevMove">prev</button>'));
		$c.append($('<button data-clickaction="play">play</button>'));
		$c.append($('<button data-clickaction="nextMove">next</button>'));
		$c.append($('<button class="not-mobile" data-clickaction="end">end</button>'));
		$c.append($('<button class="mobile" data-clickaction="flip">flip</button>'));
		// $c.append($('<label><input data-changeaction="toggleAnnotations" type="checkbox" /> Hide annotations</label>'));

		return $c;
	}

	pgnViewerModule.prototype.buildAdditionalControls = function() {
		var $c = $('<div class="additionalControls not-mobile"></div>');
		$c.append($('<button data-clickaction="flip">flip</button>'));
		$c.append($('<button data-clickaction="download">pgn</button>'));
		$c.append($('<label>FEN <input type="text" name="fen" data-clickaction="selectAll" title="ctrl+c to copy" readonly="readonly" /></label>'));
		// $c.append($('<label><input data-changeaction="toggleAnnotations" type="checkbox" /> Hide annotations</label>'));

		return $c;
	}

	// load a game from the list of games
	pgnViewerModule.prototype.loadGame = function(gameNumber, noAnnotations) {
		if(this.pgns[gameNumber] === undefined) {
			this.showError('Unable to locate that game.')
			return false;
		}

		// set the current game
		this.currentGame = this.pgns[gameNumber];

		this.currentGame.moves = this.pgns[gameNumber].moves = this.currentGame.moves || this.getMoves(this.currentGame);
		this.chessBoard.startingPosition = this.chessBoard.parseFEN(this.currentGame.fen || this.startingFEN);
		this.chessBoard.moves = this.currentGame.moves;

		// display the move interface
		this.updateGameDetails();
		this.displayMoves();
		this.chessBoard.jumpToMove(-1);
		this.updateBoard();

		return true;
	};

	// update the game information
	pgnViewerModule.prototype.updateGameDetails = function() {
		var items = [];
		var $item;

		var text = [];

		$item = $('<h2></h2>');

		text.push(this.currentGame.white || 'NN');
		if(this.currentGame.whiteelo !== undefined)
			text.push('(' + this.currentGame.whiteelo + ')')
		text.push('-')
		text.push(this.currentGame.black || 'NN')
		if(this.currentGame.blackelo !== undefined)
			text.push('(' + this.currentGame.blackelo + ')');

		$item.html(text.join(' '));
		items.push($item);
		text = [];

		if(this.currentGame.event !== undefined) {
			$item = $('<h3></h3>');
			if(this.currentGame.round !== undefined) {
				text.push('Round');
				text.push(this.currentGame.round);
				text.push('of');
			}

			text.push(this.currentGame.event);

			if(this.currentGame.eventdate !== undefined) {
				text.push('[');
				text.push(this.currentGame.eventdate);
				text.push(']');
			}

			$item.html(text.join(' '));
			text = [];
			items.push($item);
		}

		if(this.currentGame.date !== undefined) {
			$item = $('<h4></h4>')
			$item.html(this.currentGame.date);
			items.push($item);
		}

		// clear the old details
		this.$el('details').empty();
		this.$el('details').append(items);
	};

	// update the GUI with the new move
	pgnViewerModule.prototype.updateBoard = function(board, move) {
		// get the new board
		var diagram = this.generateDiagram(board);
		// set the current move
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

		// unhighlight all the moves
		this.$el('clickMove').removeClass('active');
		// highlight the current move
		var $note = this.$el('clickMove').filter('[data-actionvalue="' + this.chessBoard.currentMove + '"]');
		$note.addClass('active');

		// get the new scroll position
		var newScrollPos = 0;
		if($note.length > 0) {
			newScrollPos = $note.offset().top - this.$el('notation').offset().top + this.$el('notation').scrollTop();
		}

		// update the FEN input box with the new position
		if(move === undefined || move.fen === undefined) {
			this.$el('fenInput').val(this.chessBoard.convertBoardToFEN(this.chessBoard.startingPosition));
		}
		else {
			this.$el('fenInput').val(move.fen);
		}

		// scroll the notation window to the new position
		this.$el('notation').scrollTop(newScrollPos);

		// update the comment box with the new information
		if(move && move.fullText !== undefined) {
			var moveText = [];
			moveText.push('<p>');

			// apply comments before the move
			moveText.push(move.commentBefore || '');
			moveText.push(' ');

			// add the move text
			moveText.push('<strong>')
			moveText.push(move.moveNumber);
			moveText.push(move.player === 'w' ? '. ' : '... ')
			moveText.push(move.algebraic);

			// add the check indicator
			if(move.check !== undefined) {
				moveText.push(move.check);
			}

			// add the NAG
			if(move.NAG !== undefined) {
				moveText.push(pgnViewerModule.NAGMap[move.NAG]);
			}

			moveText.push('</strong>')

			// add the comments after the move
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
		this.$el('board').html('<div class="diagram">' + diagram + '</div>');
		this.$el('board').append(this.drawPaint(move));
	}

	// Unfinished code to draw arrows/highlights on the gui
	pgnViewerModule.prototype.drawPaint = function(move) {
		if(move === undefined) {
			return;
		}
		if(!((move.arrow !== undefined && move.arrow.length > 0) || (move.highlight !== undefined && move.highlight.length > 0))){
			return;
		}

		var height = this.$el('board').height();
		var width = this.$el('board').width();
	}

	// redraw the moves for the current game
	pgnViewerModule.prototype.displayMoves = function() {
		// update the gui
		this.$el('notation').html(this.setupNotation(this.chessBoard.moves));
		// refresh the module's clickMove elements
		this.$el('clickMove', true);
	}

	// update the move window interface with the current moves
	pgnViewerModule.prototype.setupNotation = function(rMoves, variationNumber) {
		var html = [];
		var self = this;

		// A recursive method that will render moves and variations into an html interface
		var renderMoves = function(moveArray, addressPrepend) {
			var output = []; // the full output
			var i = 0; // all the moves of the game
			var j = 0; // indicates the moves of this pair
			var address = []; // the parts of the address for a particular move
			var numberSet = false; // determines if the number of this move pair has been displayed
			var whiteMove = false;
			var blackMoveFirst = false;

			// loop over all the moves provided
			while(i < moveArray.length) {
				numberSet = false;
				blackMoveFirst = false;
				j = 0;

				while(j < 2) { // get the white and black moves
					if(moveArray[i+j]) { // the actual move
						
						// Reset the move address
						address = [];
						if(addressPrepend) {
							// add the prepend if necessary
							address.push(addressPrepend);
						}

						// add the move number to the address
						address.push(i+j);
						// open the clickable region
						html.push(' <span data-clickaction="clickMove" data-actionvalue="' + address.join('.') + '" ' + (moveArray[i+j].error !== undefined ? 'class="error"' : '') + '>');

						 // generate the move number
						if(!numberSet) {
							// if the move is white's add one period
							if(moveArray[i+j].player === 'w') {
								whiteMove = true;
								html.push(moveArray[i+j].moveNumber + '. '); 
							}

							// if the move is black's add three periods
							else {
								blackMoveFirst = !whiteMove;
								html.push(moveArray[i+j].moveNumber + '... ');
							}

							numberSet = true;
						}
						

						// assign the move address
						moveArray[i+j].address = address.join('.');

						// Draw the algebraic notation
						html.push(moveArray[i+j].algebraic + (moveArray[i+j].check || '')); 

						// Convert the Numeric Annotation Glyphs to a human readable form
						if(moveArray[i+j].NAG !== undefined) {
							html.push(pgnViewerModule.NAGMap[moveArray[i+j].NAG]);
						}

						// Add an indication that comments are associated with this move
						if(moveArray[i+j].commentBefore !== '' || moveArray[i+j].commentAfter !== '') {
							html.push('<sup>c</sup>');
						}

						// Add an indication that there are arrows or highlights associated with this move
						// if((moveArray[i+j].arrow !== undefined && moveArray[i+j].arrow.length > 0) || (moveArray[i+j].highlight !== undefined && moveArray[i+j].highlight.length > 0)) {
						// 	html.push('&#9630;')
						// }

						// close the clickable region
						html.push('</span>');

						 // use recrusion to render the variations
						if(moveArray[i+j].variations.length > 0) {
							for (var k = 0; k < moveArray[i+j].variations.length; k++) {
								html.push('<span class="variation">( '); // open the variation
								
								address = []; // Reset the move address
								if(addressPrepend) {
								// add the prepend if necessary
									address.push(addressPrepend);
								}

								// add the move number to the address
								address.push(i+j);

								// add the variation number to the address
								address.push(k+1);

								// recursively render variations
								var obj = renderMoves(moveArray[i+j].variations[k], address.join('.'))

								// attached the moves to the variations
								moveArray[i+j].variations[k] = obj.moves;

								// add the variation html to the output html
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

			// return the html output and the moves
			return { html: output.join(''), moves: moveArray };
		}

		// render all the moves
		var obj = renderMoves(rMoves);

		// attached the moves to the chess board
		this.chessBoard.moves = obj.moves;
		html.push(obj.html);

		// join the html result
		return html.join('') + '<span class="result">'+ (this.currentGame.result || '*') + '</span>';
	}

	// Given a PGN, this will return a pgn stripped of all annotations and variations
	pgnViewerModule.prototype.getPlainGame = function(game) {
		// verify a pgn was provided
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

	// Grab the PGNs from various locations, either from the DOM or a file
	pgnViewerModule.prototype.loadPGNs = function(callback) {
		var pgnString = '';
		var self = this;

		var buildPGNs = function(response) {
			pgnString += response;

			// get the data from the pgn attribute
			if(self.$module.data('pgn')) {
				pgnString += ' ' + self.$module.data('pgn');
			}

			// separate the PGNs by their result
			// search for 1-0, 0-1, 1/2-1/2, ½\-½, or * but exclude any that fall between quotes or curly braces
			var regex = /(1\-0|0\-1|1\/2\-1\/2|½\-½|\*)(?=(?:[^{]*{[^}]*})*[^}]*$)(?=(?:[^"]*"[^"]*")*[^"]*$)/ig;
			var pgnArray = pgnString.split(regex);

			// remove empty values
			pgnArray.clean('');
			pgnArray.clean(' ');
			// remove undefined values
			pgnArray.clean(undefined);

			// combine the pgn with the separated result to get a complete pgn
			var count = 0;
			for (var i = 0; i < pgnArray.length; i++) {
				self.pgns[count] = self.buildGameFromPGN((pgnArray[i] + pgnArray[i+1]).trim());
				count++;
				i++;
			};
			// remove the uncessary pgnArray
			delete pgnArray;

			if(self.pgns.length === 0)
			{
				self.showError('No valid PGNs found.');
			}

			callback();
		}

		// if a file is specified, retrieve it via ajax
		if(this.$module.data('pgn-file')) {
			$.ajax({
				url: this.$module.data('pgn-file'),
				success: buildPGNs
			});
		}
		else {
			buildPGNs();
		}
	};

	// Given a PGN, this method will parse out the tags, moves, 
	// variations, and comments so they will be in a useable form
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

	// Converts nested variation strings to useable moves (recursive)
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

	// Display an error message
	pgnViewerModule.prototype.showError = function(message) {
		console.info('PGN Viewer Error: ' + message)
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

		// complex regex to get data associated with csl and cal tags
		var paintRegex = /(\[%csl(?:\s*)((?:(?:R|G)[a-h][1-8](?:\,)?)*)\])?(\[%cal(?:\s*)((?:(?:R|G)[a-h][1-8][a-h][1-8](?:\,)?)*)\])?/gi;
		var arrowRegex = /(R|G)([a-h][1-8])([a-h][1-8])/gi;
		var highlightRegex = /(R|G)([a-h][1-8])/gi;
		var highlight;
		var arrow;

		// Convert paint tags on each move to something the script can read and generate on screen
		for (var i = 0; i < moves.length; i++) {
			if(moves[i].commentAfter !== undefined && moves[i].commentAfter !== '') {
				moves[i].commentAfter = moves[i].commentAfter.replace(paintRegex, function() {
					if(arguments[1] !== undefined) {
						highlight = (arguments[2] || '').split(',');
						arrow = (arguments[4] || '').split(',');

						moves[i].arrow = [];
						moves[i].highlight = [];

						for (var j = 0; j < arrow.length; j++) {
							arrow[j].replace(arrowRegex, function() {
								moves[i].arrow.push({
									color: arguments[1] === 'R' ? 'red' : 'green',
									start: ChessBoard.squareMap[arguments[2]],
									end: ChessBoard.squareMap[arguments[3]]
								});
							});
						};

						for (var k = 0; k < highlight.length; k++) {
							highlight[k].replace(highlightRegex, function() {
								moves[i].highlight.push({
									color: arguments[1] === 'R' ? 'red' : 'green',
									square: ChessBoard.squareMap[arguments[2]]
								});
							});
						};
					}
					return '';
				});
			}
		};

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
		{
			output.push('<div class="rank top"><div></div><div>h</div><div>g</div><div>f</div><div>e</div><div>d</div><div>c</div><div>b</div><div>a</div><div></div></div>');
		}
		else
		{			
			//output.push('XABCDEFGHY');
			output.push('<div class="rank top"><div></div><div>a</div><div>b</div><div>c</div><div>d</div><div>e</div><div>f</div><div>g</div><div>h</div><div></div></div>');
		}

		// depending on orientation, the counter needs to go up or down
		i = this.chessBoard.flip ? 7 : 56;

		// used to determine if the squares will be dark or light
		darkSquare = this.chessBoard.flip;

		while(i < 64 && i >= 0) {
			j = 0;
			rank = [];
			rankNumber = this.chessBoard.flip ? (i+1)/8 : (i+8)/8;

			rank.push('<div class="rank">');
			rank.push('<div><span><span>' + rankNumber + '</span></span></div>');

			// add the left border
			// rank.push(rankNumber);

			while(j < 8) {

				rank.push('<div');
				// calculate the current board position
				pos = this.chessBoard.flip ? i-j : i+j;

				isDark = (darkSquare && pos%2 === 0) || (!darkSquare && pos%2 !== 0);

				if(isDark)
				{
					rank.push(' class="dark-square"');
				}

				rank.push('>');

				// if the square is occupied
				if(board.squares[pos]) {
					var img = (board.squares[pos].owner + board.squares[pos].fen).toLowerCase();
					rank.push('<img src="images/' + img + '.svg" />');
				}
				else {
					rank.push('<img src="images/empty.svg" />');
				}

				rank.push('</div>');
				
				j++; // continue across the rank
			}

			// add the right border
			//rank.push(this.diagramBorderMap[rankNumber]);
			rank.push('<div><span><span>' + rankNumber + '</span></span></div>');
			rank.push('</div>');

			i+= this.chessBoard.flip ? 8 : -8;

			// join the rank text
			output.push(rank.join(''));

			// switch the darksquare marker
			darkSquare = !darkSquare;
		}

		// show the bottom border of the board
		if(this.chessBoard.flip)
		{
			output.push('<div class="rank top"><div></div><div>h</div><div>g</div><div>f</div><div>e</div><div>d</div><div>c</div><div>b</div><div>a</div><div></div></div>');
		}
		else
		{			
			//output.push('XABCDEFGHY');
			output.push('<div class="rank bottom"><div></div><div>a</div><div>b</div><div>c</div><div>d</div><div>e</div><div>f</div><div>g</div><div>h</div><div></div></div>');
		}

		// join all the text required for the diagram
		return output.join('');
	};

	// Returns a constructed regex necessary for parsing chess moves
	pgnViewerModule.prototype.moveRegex = function() {
		if(!this._moveRegex)
		{
			// the regex for finding chess moves
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

	// a map of NAG => readable
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

return pgnViewerModule;

})(jquery_1_10_1);