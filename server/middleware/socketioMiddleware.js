const { getRooms, leaveRoom, getRoomById, getRoomPlayers, updateRoomEndGame, insertNewGame } = require('../models/roomModel');
const { getGameById, updateFinishedGame } = require('../models/gameModel');
const { updateBanInGame, updateStatLose, updateStatWin } = require('../models/userModel');
const { getConfigs } = require('../models/configModel');
const jwt = require('jsonwebtoken');

const onlineUsers = {};
const statusUsers = {};
const activeGames = {};
const activeIntervals = {};

const socketioMiddleware = (io) => {
    io.use((socket, next) => {
        const cookies = socket.request.headers.cookie;
        if (!cookies) {
            return next(new Error('ไม่ได้รับคุกกี้จากคำขอ'));
        }

        const parsedCookies = Object.fromEntries(
            cookies.split('; ').map(cookie => cookie.split('=').map(decodeURIComponent))
        );

        const token = parsedCookies.token;

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.permission === 'member' || decoded.permission === 'admin') {
                socket.user = decoded;
                return next();
            } else {
                return next(new Error('ไม่ได้รับอนุญาตให้เข้าถึง'));
            }
        } catch (err) {
            console.error('ไม่สามารถตรวจสอบโทเคนได้:', err.message);
            return next(new Error('โทเคนไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'));
        }
    });

    io.on('connection', (socket) => {
        // console.log('ผู้ใช้เชื่อมต่อสำเร็จ:', socket.user);

        if (socket.user.permission === 'member') {
            onlineUsers[socket.user.id] = socket.id;
        }

        io.emit('onlineUserCount', Object.keys(onlineUsers).length);

        socket.on("updateStatus", ({ user_id, room_id, game_id }) => {
            statusUsers[user_id] = { room_id, game_id };
        });

        socket.on("leaveStatus", (user_id) => {
            if (statusUsers[user_id]) {
                delete statusUsers[user_id];
            }
        });

        socket.on("getUserStatus", async (user_id, callback) => {
            const userStatus = statusUsers[user_id];

            if (!userStatus) {
                return callback(null);
            }

            const { room_id, game_id } = userStatus;

            if (!room_id) {
                delete statusUsers[user_id];
                return callback(null);
            }

            const room = await getRoomById(room_id);
            if (room?.play_status === "เริ่มเกมแล้ว" && !game_id) {
                const game_id = await getGameById(room_id);
                if (game_id) {
                    statusUsers[user_id] = { room_id, game_id };
                    return callback(statusUsers[user_id]);
                }
            } else if (room?.play_status === "จบเกมแล้ว") {
                delete statusUsers[user_id];
                return callback(null);
            }

            return callback(room ? statusUsers[user_id] : null);
        });

        socket.on('getOnlineUsers', () => {
            const members = Object.keys(onlineUsers).length;
            socket.emit('onlineUserCount', members);
        });

        socket.on('disconnect', () => {
            if (onlineUsers[socket.user.id]) {
                // console.log(`ผู้ใช้ตัดการเชื่อมต่อ: ${onlineUsers[socket.user.id]}`);
                delete onlineUsers[socket.user.id];
            }
            io.emit('onlineUserCount', Object.keys(onlineUsers).length);
        });

        socket.on('joinRoom', async (room_id) => {
            const user_id = socket.user.id;
            const players = await getRoomPlayers(room_id);
            const isPlayerInRoom = players.some(player => player.user_id === user_id);

            if (!isPlayerInRoom) {
                socket.emit('unauthorizedAccess');
                return;
            }

            socket.join(room_id);
            await updateRoomPlayer(io, room_id);

            if (players.length === 6) {
                if (activeIntervals[`countdown_${room_id}`]) {
                    socket.emit("countdownUpdate", { timeLeft: activeIntervals[`countdown_${room_id}_time`] });
                } else {
                    startCountdownTimer(io, room_id);
                }
            } else {
                stopCountdownTimer(room_id);
            }

            socket.on('roomDeleted', () => {
                socket.emit('roomDeleted');
            });
            socket.on('gameStarted', () => {
                socket.emit('gameStarted');
            });
        });

        socket.on("requestCountdown", (room_id) => {
            if (activeIntervals[`countdown_${room_id}_time`]) {
                socket.emit("countdownUpdate", { timeLeft: activeIntervals[`countdown_${room_id}_time`] });
            }
        });

        socket.on("requestCountdownStopped", (room_id) => {
            if (activeIntervals[`countdown_${room_id}_time`]) {
                stopCountdownTimer(room_id);
                io.to(room_id).emit("countdownStopped");
            }
        });

        socket.on('leaveRoom', async (room_id) => {
            socket.leave(room_id);
            await updateRoomPlayer(io, room_id);

            const players = await getRoomPlayers(room_id);
            if (players.length < 6) {
                stopCountdownTimer(room_id);
                io.to(room_id).emit("countdownStopped");
            }
        });

        socket.on('requestRooms', async () => {
            const rooms = await getRooms();
            socket.emit('roomsUpdate', rooms);
        });

        socket.on('requestDetailRoom', async (room_id) => {
            const roomDetail = await getRoomById(room_id);
            socket.emit('roomsDetailUpdate', roomDetail);
        });

        socket.on("redirectOldCreator", ({ oldCreatorId }) => {
            const oldCreatorSocketId = onlineUsers[oldCreatorId];
            if (oldCreatorSocketId) {
                io.to(oldCreatorSocketId).emit("roomRedirect");
            }
        });

        socket.on("joinGame", async (room_id, game_id) => {
            const user_id = socket.user.id;
            const players = await getRoomPlayers(room_id);
            const isPlayerInRoom = players.some(player => player.user_id === user_id);

            if (!isPlayerInRoom) {
                socket.emit('unauthorizedAccess');
                return;
            }

            socket.join(game_id);
        });

        socket.on('leaveGame', async (game_id) => {
            socket.leave(game_id);
        });

        socket.on('gameActivated', async ({ room_id, game_id }) => {
            if (!activeGames[game_id]) {
                const config = await getConfigs();
                const turn_time = parseInt(config[1].config_value, 10);
                const popup_time = parseInt(config[2].config_value, 10);
                let players = await getRoomPlayers(room_id);
                if (!players || players.length === 0) {
                    return socket.emit("updateGame", { error: "ไม่มีผู้เล่นในห้องนี้" });
                }

                let deck = ['cat', 'lion', 'bear', 'turtle', 'crocodile', 'cat', 'lion', 'bear', 'turtle', 'crocodile', 'cat', 'lion', 'bear', 'turtle', 'crocodile'];
                let background = ['bgCat', 'bgLion', 'bgBear', 'bgTurtle', 'bgCrocodile'];

                shuffleArray(deck);
                shuffleArray(players);
                shuffleArray(background);

                players = players.map(player => ({
                    ...player,
                    coin: 2,
                    cards: deck.splice(0, 2),
                    status: "alive",
                    banStack: 0,
                    isWin: false
                }));
                activeGames[game_id] = {
                    room_id,
                    game_id,
                    players,
                    state: {
                        deck: deck,
                        gameFinished: "",
                        passedPlayers: [],
                        playerDropCard: {},
                        currentAction: { action: "", user_id: "", claimedCard: "", target_id: "", blocked: false },
                        popupTime: popup_time,
                        defaultPopupTime: popup_time,
                        timeTurn: turn_time,
                        defaultTimeTurn: turn_time,
                        currentTurn: players[0].user_id,
                        background: background.splice(0, 1)[0]
                    },
                    chat: [],
                    history: []
                };

                startTurnTimer(io, game_id);
            }

            if (activeGames[game_id]) {
                socket.emit("updateGame", activeGames[game_id]);
                // console.log(JSON.stringify(activeGames[game_id], null, 2));
            } else {
                socket.emit("updateGame", { error: "ไม่มีเกมหมายเลขนี้" });
            }
        });

        socket.on("leavePlayerGame", async ({ game_id, user_id, type }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);

            if (!player) return;

            if (type === "leave") {
                game.players = game.players.filter(player => player.user_id !== user_id);
                io.to(game_id).emit("updateGame", game);
                await updateStatLose(player.user_id);
            }

            game.state.voteTimer = 0;
        });

        socket.on("nextGame", async ({ game_id, user_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];

            if (!game.state.passedPlayers.includes(user_id)) {
                game.state.passedPlayers.push(user_id);
            }
        });

        socket.on("requestGameChat", (game_id, callback) => {
            if (!activeGames[game_id] || !Array.isArray(activeGames[game_id].chat)) {
                return callback([]);
            }
            callback(activeGames[game_id].chat);
        });

        socket.on("requestGameHistory", (game_id, callback) => {
            if (!activeGames[game_id] || !Array.isArray(activeGames[game_id].history)) {
                return callback([]);
            }
            callback(activeGames[game_id].history);
        });

        socket.on("sendChatMessage", ({ game_id, sender, message }) => {
            if (!game_id || !sender || !message.trim()) return;

            if (!activeGames[game_id]) {
                return socket.emit("receiveChatMessage", { error: "Game not found" });
            }

            const game = activeGames[game_id];

            if (!Array.isArray(game.chat)) {
                game.chat = [];
            }

            const chatMessage = { sender, message, timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) };
            game.chat.push(chatMessage);

            if (game.chat.length > 30) {
                game.chat.splice(0, game.chat.length - 30);
            }

            io.to(game_id).emit("receiveChatMessage", chatMessage);
        });

        socket.on("incomeAction", ({ game_id, user_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);

            if (game.state.currentTurn !== user_id || player.status !== "alive") return;

            if (player) {
                player.coin += 1;
                addHistory(io, game, game_id, `${player.player_name}: ใช้ความสามารถ เก็บ 1 เหรียญ`);
                nextPlayerTurn(io, game_id);
            }
        });

        socket.on("foreignAidAction", ({ game_id, user_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);

            if (game.state.currentTurn !== user_id || player.status !== "alive") return;

            stopTurnTimer(game_id);
            addHistory(io, game, game_id, `${player.player_name}: ใช้ความสามารถ ขอ 2 เหรียญ`);

            game.state.currentAction = { action: "foreignAid", user_id: player.user_id, claimedCard: "lion", target_id: null, blocked: false };

            startPopupTimer(io, game_id, () => {
                if (game.state.currentAction.blocked) {
                    addHistory(io, game, game_id, `${player.player_name}: ขอ 2 เหรียญไม่สำเร็จ ถูกป้องกันโดย สิงโต`);
                } else {
                    player.coin += 2;
                    addHistory(io, game, game_id, `${player.player_name}: ได้รับ 2 เหรียญ`);
                }
                nextPlayerTurn(io, game_id);
            });
        });

        socket.on("coupAction", ({ game_id, user_id, target_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);
            const targetPlayer = game.players.find(p => p.user_id === target_id);

            if (!player || !targetPlayer || player.status !== "alive" || targetPlayer.status !== "alive") return;
            if (game.state.currentTurn !== user_id || player.coin < 7) return;

            stopTurnTimer(game_id);
            addHistory(io, game, game_id, `${player.player_name}: ใช้ความสามารถ โค่นอำนาจ กับ ${targetPlayer.player_name}`);

            player.coin -= 7;
            game.state.currentAction = { action: "coup", user_id: user_id, claimedCard: "", target_id: target_id, blocked: false };

            io.to(game_id).emit("chooseCardDrop", { user_id: target_id });

            startPopupTimer(io, game_id, () => { });

            game.state.playerDropCard = { user_id: target_id, status: "coup" };
        });

        socket.on("taxAction", ({ game_id, user_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);

            if (game.state.currentTurn !== user_id || player.status !== "alive") return;

            stopTurnTimer(game_id);
            addHistory(io, game, game_id, `${player.player_name}: ใช้ความสามารถ ขอภาษี`);

            game.state.currentAction = { action: "tax", user_id: player.user_id, claimedCard: "lion", target_id: null, blocked: false };

            startPopupTimer(io, game_id, () => {
                player.coin += 3;
                addHistory(io, game, game_id, `${player.player_name}: ได้รับ 3 เหรียญจากการขอภาษี`);
                nextPlayerTurn(io, game_id);
            });
        });

        socket.on("assassinateAction", ({ game_id, user_id, target_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);
            const targetPlayer = game.players.find(p => p.user_id === target_id);

            if (!player || !targetPlayer || player.status !== "alive" || targetPlayer.status !== "alive") return;
            if (game.state.currentTurn !== user_id || player.coin < 3) return;

            stopTurnTimer(game_id);
            addHistory(io, game, game_id, `${player.player_name}: ใช้ความสามารถ ลอบสังหาร กับ ${targetPlayer.player_name}`);

            player.coin -= 3;
            game.state.currentAction = {
                action: "assassinate",
                user_id: player.user_id,
                claimedCard: "crocodile",
                target_id: targetPlayer.user_id,
                blocked: false,
                secondPhase: false,
            };

            startPopupTimer(io, game_id, () => {
                if (!game.state.currentAction.secondPhase) {
                    if (game.state.currentAction.blocked) {
                        addHistory(io, game, game_id, `${player.player_name}: ลอบสังหารไม่สำเร็จ ถูกป้องกันโดย เต่า`);
                        nextPlayerTurn(io, game_id);
                    } else {
                        if (targetPlayer.status !== "eliminated") {
                            game.state.playerDropCard = { user_id: target_id, status: "assassinate" };
                            startAssassinateTimer(io, game_id, () => {
                                io.to(game_id).emit("chooseCardDrop", { user_id: target_id });
                            });
                            addHistory(io, game, game_id, `${player.player_name}: การลอบสังหารสำเร็จ`);
                        } else {
                            nextPlayerTurn(io, game_id);
                        }
                    }
                } else {
                    startPopupTimer(io, game_id, () => {
                        if (game.state.currentAction.blocked) {
                            addHistory(io, game, game_id, `${player.player_name}: ลอบสังหารไม่สำเร็จ ถูกป้องกันโดย เต่า`);
                            nextPlayerTurn(io, game_id);
                        } else {
                            if (targetPlayer.status !== "eliminated") {
                                game.state.playerDropCard = { user_id: target_id, status: "assassinate" };
                                startAssassinateTimer(io, game_id, () => {
                                    io.to(game_id).emit("chooseCardDrop", { user_id: target_id });
                                });
                                addHistory(io, game, game_id, `${player.player_name}: การลอบสังหารสำเร็จ`);
                            } else {
                                nextPlayerTurn(io, game_id);
                            }
                        }
                    });
                }
            });
        });

        socket.on("exchangeAction", ({ game_id, user_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);

            if (game.state.currentTurn !== user_id || player.status !== "alive") return;

            stopTurnTimer(game_id);
            addHistory(io, game, game_id, `${player.player_name}: ใช้ความสามารถ แลกเปลี่ยน`);

            game.state.currentAction = { action: "exchange", user_id: player.user_id, claimedCard: "bear", target_id: null, blocked: false };

            startPopupTimer(io, game_id, () => {
                io.to(game_id).emit("updateGame", game);

                const drawnCards = game.state.deck.splice(0, 2);
                const availableCards = [...player.cards, ...drawnCards];

                game.state.currentAction.exchanged = true

                const alivePlayers = game.players.filter(player => player.status === "alive");
                if (alivePlayers.length === 1) {
                    stopExchangeTimer(game_id);
                    game.state.gameFinished = alivePlayers[0].player_name;
                    addHistory(io, game, game_id, `${alivePlayers[0].player_name}: เป็นผู้ชนะ!`);
                    alivePlayers[0].isWin = true;
                    delete game.state.currentAction;
                    game.state.passedPlayers = [];
                    stopTurnTimer(game_id);
                    io.to(game_id).emit("updateGame", game);
                    startVoteTimer(io, game_id);
                    return;
                }

                startExchangeTimer(io, game_id, drawnCards, () => {
                    io.to(game_id).emit("chooseExchange", { user_id, availableCards, maxSelection: player.cards.length, drawnCards });
                });
            });
        });

        socket.on("confirmExchange", ({ game_id, user_id, selectedCards, drawnCards }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);

            if (game.state.exchangeProcessing) return;

            if (!player || !selectedCards || selectedCards.length !== player.cards.length) return;

            const availableCards = [...player.cards, ...drawnCards];
            if (!selectedCards.every(card => availableCards.includes(card))) return;

            game.state.exchangeProcessing = true;
            game.state.currentAction.exchanged = false;
            stopExchangeTimer(game_id);

            let remainingCards = [...player.cards, ...drawnCards];
            selectedCards.forEach(selected => {
                const index = remainingCards.findIndex(card => card === selected);
                if (index !== -1) remainingCards.splice(index, 1);
            });

            game.state.deck.unshift(...remainingCards);
            player.cards = [...selectedCards];

            shuffleArray(game.state.deck);
            addHistory(io, game, game_id, `${player.player_name}: การแลกเปลี่ยนสำเร็จ`);
            nextPlayerTurn(io, game_id);
        });

        socket.on("stealAction", ({ game_id, user_id, target_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);
            const targetPlayer = game.players.find(p => p.user_id === target_id);

            if (!player || !targetPlayer || player.status !== "alive" || targetPlayer.status !== "alive") return;
            if (game.state.currentTurn !== user_id || targetPlayer.coin <= 0) return;

            stopTurnTimer(game_id);
            addHistory(io, game, game_id, `${player.player_name}: ใช้ความสามารถ ขโมย กับ ${targetPlayer.player_name}`);

            game.state.currentAction = {
                action: "steal",
                user_id: player.user_id,
                claimedCard: "cat",
                target_id: targetPlayer.user_id,
                blocked: false,
                secondPhase: false,
            };

            startPopupTimer(io, game_id, () => {
                if (!game.state.currentAction.secondPhase) {
                    if (game.state.currentAction.blocked) {
                        const cardName = game.state.currentAction.claimedCard === "cat" ? "แมว" : "หมี";
                        addHistory(io, game, game_id, `${player.player_name}: ขโมยไม่สำเร็จ ถูกป้องกันโดย ${cardName}`);
                    } else {
                        let stolenAmount = Math.min(2, targetPlayer.coin);
                        targetPlayer.coin -= stolenAmount;
                        player.coin += stolenAmount;
                        addHistory(io, game, game_id, `${player.player_name}: ได้รับ ${stolenAmount} เหรียญจากการขโมย`);
                    }
                    nextPlayerTurn(io, game_id);
                } else {
                    startPopupTimer(io, game_id, () => {
                        if (game.state.currentAction.blocked) {
                            const cardName = game.state.currentAction.claimedCard === "cat" ? "แมว" : "หมี";
                            addHistory(io, game, game_id, `${player.player_name}: ขโมยไม่สำเร็จ ถูกป้องกันโดย ${cardName}`);
                        } else {
                            let stolenAmount = Math.min(2, targetPlayer.coin);
                            targetPlayer.coin -= stolenAmount;
                            player.coin += stolenAmount;
                            addHistory(io, game, game_id, `${player.player_name}: ได้รับ ${stolenAmount} เหรียญจากการขโมย`);
                        }
                        nextPlayerTurn(io, game_id);
                    });
                }
            });
        });

        socket.on("passAction", ({ game_id, user_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];

            if (!game.state.passedPlayers.includes(user_id)) {
                game.state.passedPlayers.push(user_id);
            }
        });

        socket.on("blockAction", ({ game_id, user_id, blockedAction, claimedCard = {} }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const blocker = game.players.find(p => p.user_id === user_id);

            if (!blocker || blocker.status !== "alive") return;
            if (!game.state.currentAction || game.state.currentAction.action !== blockedAction) return;

            game.state.popupTime = game.state.defaultPopupTime;
            game.state.currentAction.blocked = true;
            game.state.currentAction.blockedBy = blocker.user_id;

            if (blockedAction === "foreignAid") {
                addHistory(io, game, game_id, `${blocker.player_name}: ป้องกัน การขอ 2 เหรียญ โดย สิงโต`);
            }

            if (blockedAction === "assassinate") {
                game.state.currentAction.claimedCard = "turtle"
                addHistory(io, game, game_id, `${blocker.player_name}: ป้องกัน การลอบสังหาร โดย เต่า`);
            }

            if (blockedAction === "steal") {
                game.state.currentAction.claimedCard = claimedCard.card
                addHistory(io, game, game_id, `${blocker.player_name}: ป้องกัน การขโมย โดย ${claimedCard.name}`);
            }

            io.to(game_id).emit("chooseBlockChallenge", { blocker_id: blocker.user_id });
            io.to(game_id).emit("updateGame", game);
        });

        socket.on("challengeAction", ({ game_id, challenger_id }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const challenger = game.players.find(p => p.user_id === challenger_id);
            const currentAction = game.state.currentAction;

            if (!challenger || challenger.status !== "alive") return;
            if (!currentAction.user_id || !currentAction.claimedCard) return;

            let targetPlayer;
            if (currentAction.blocked) {
                targetPlayer = game.players.find(p => p.user_id === currentAction.blockedBy);
            } else {
                targetPlayer = game.players.find(p => p.user_id === currentAction.user_id);
            }

            if (!targetPlayer || targetPlayer.status !== "alive") return;

            game.state.popupTime = game.state.defaultPopupTime;
            game.state.lastChallenger = challenger_id;
            addHistory(io, game, game_id, `${challenger.player_name}: ท้าทาย ${targetPlayer.player_name}`);
            io.to(game_id).emit("chooseCardShow", { user_id: targetPlayer.user_id });
            io.to(game_id).emit("updateGame", game);
        });

        socket.on("showCardAction", ({ game_id, user_id, selectedCard }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const currentAction = game.state.currentAction;
            const targetPlayer = game.players.find(p => p.user_id === user_id);
            const challenger = game.players.find(p => p.user_id === game.state.lastChallenger);

            if (!challenger || !targetPlayer) return;

            let historyMessage = "";
            game.state.popupTime = game.state.defaultPopupTime;

            if (selectedCard === currentAction.claimedCard) {
                game.state.playerDropCard = { user_id: challenger.user_id, status: "challenger" };
                io.to(game_id).emit("chooseCardDrop", { user_id: challenger.user_id });

                const cardIndex = targetPlayer.cards.indexOf(selectedCard);
                if (cardIndex > -1) {
                    game.state.deck.unshift(targetPlayer.cards.splice(cardIndex, 1)[0]);
                    shuffleArray(game.state.deck);
                    targetPlayer.cards.push(game.state.deck.shift());
                }
                historyMessage = `${challenger.player_name}: ท้าทายไม่สำเร็จและเลือกเสียการ์ด 1 ใบ`;
            } else {
                game.state.playerDropCard = { user_id: targetPlayer.user_id, status: "challenged" };
                io.to(game_id).emit("chooseCardDrop", { user_id: targetPlayer.user_id });
                historyMessage = `${targetPlayer.player_name}: ถูกท้าทายสำเร็จและเลือกเสียการ์ด 1 ใบ`;
            }

            addHistory(io, game, game_id, historyMessage);
            io.to(game_id).emit("updateGame", game);
        });

        socket.on("dropCardAction", ({ game_id, user_id, card, name }) => {
            if (!activeGames[game_id]) return;

            const game = activeGames[game_id];
            const player = game.players.find(p => p.user_id === user_id);

            if (game.state.playerDropCard.processing) return;
            game.state.playerDropCard.processing = true;

            if (!player || !player.cards.includes(card)) return;

            const cardIndex = player.cards.lastIndexOf(card);
            if (cardIndex === -1) return;

            player.cards.splice(cardIndex, 1);
            game.state.popupTime = 0;
            game.state.assassinateTime = 0;
            stopAssassinateTimer(game_id);

            addHistory(io, game, game_id, `${player.player_name}: สูญเสียการ์ด ${name}`);

            if (player.cards.length === 0) {
                player.status = "eliminated";
                addHistory(io, game, game_id, `${player.player_name}: แพ้แล้ว! ถูกคัดออกจากเกม`);
            }

            if (game.state.playerDropCard.status === "challenger") {
                game.state.playerDropCard = {};
                if ((game.state.currentAction.action === "assassinate" || game.state.currentAction.action === "steal") && !game.state.currentAction.blocked && game.state.lastChallenger !== game.state.currentAction.target_id) {
                    game.state.currentAction.secondPhase = true;
                }
                delete game.state.lastChallenger;
            } else {
                if ((game.state.currentAction.action === "assassinate" || game.state.currentAction.action === "steal") && game.state.currentAction.blocked) {
                    game.state.playerDropCard = {};
                    game.state.currentAction.blocked = false;
                    delete game.state.lastChallenger;
                } else {
                    delete game.state.lastChallenger;
                    stopPopupTimer(game_id);
                    nextPlayerTurn(io, game_id);
                }
            }
        });

        socket.on("userBanInGame", ({ game_id, user_id, status }) => {
            if (!activeGames[game_id]) return;
            const game = activeGames[game_id];
            const targetPlayer = game.players.find(p => p.user_id === user_id);

            if (game.state.currentTurn === user_id) {
                let currentIndex = game.players.findIndex(p => p.user_id === game.state.currentTurn);
                const nextIndex = (currentIndex + 1) % game.players.length;
                game.players = game.players.filter(player => player.user_id !== user_id);
                game.state.currentIndex = { status: true, index: nextIndex };
                stopTurnTimer(game_id);
                nextPlayerTurn(io, game_id);
            }

            game.players = game.players.filter(player => player.user_id !== user_id);

            if (game.players.length === 1) {
                stopTurnTimer(game_id);
                nextPlayerTurn(io, game_id);
            }

            if (status) {
                historyMessage = `${targetPlayer.player_name}: ถูกระบบแบนออกจากเกม!`
            } else {
                historyMessage = `${targetPlayer.player_name}: ถูกระบบลบบัญชีออกจากเกม!`
            }

            addHistory(io, game, game_id, historyMessage);
            io.to(game_id).emit("updateGame", game);
        });
    });
};

const updateRoomPlayer = async (io, room_id) => {
    try {
        const players = await getRoomPlayers(room_id);
        io.to(room_id).emit('updatePlayers', players);
    } catch (error) {
        console.error(`ไม่สามารถดึงข้อมูลผู้เล่นในห้องได้ ${room_id}:`, error.message);
    }
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

const startTurnTimer = async (io, game_id) => {
    stopTurnTimer(game_id);

    const game = activeGames[game_id];
    if (!game) return;

    const room_id = game.room_id;
    io.to(game_id).emit("updateGame", game);

    const interval = setInterval(async () => {
        if (!game) {
            stopTurnTimer(game_id);
            return;
        }

        game.state.timeTurn -= 1;
        io.to(game_id).emit("updateGame", game);

        if (game.state.timeTurn <= 0) {
            const currentPlayer = game.players.find(p => p.user_id === game.state.currentTurn);
            if (!currentPlayer) return;

            if (currentPlayer.banStack < 3) currentPlayer.banStack += 1;

            if (currentPlayer.banStack === 3) {
                await updateBanInGame(currentPlayer.user_id);
                await leaveRoom(room_id, currentPlayer.user_id);
                await updateRoomPlayer(io, room_id);
                if (statusUsers[currentPlayer.user_id]) {
                    delete statusUsers[currentPlayer.user_id];
                }
                io.to(onlineUsers[currentPlayer.user_id]).emit("redirectToBan");

                let currentIndex = game.players.findIndex(p => p.user_id === game.state.currentTurn);
                const nextIndex = (currentIndex + 1) % game.players.length;

                game.players = game.players.filter(player => player.user_id !== currentPlayer.user_id);
                game.state.currentIndex = { status: true, index: nextIndex };

                addHistory(io, game, game_id, `${currentPlayer.player_name}: ไม่ใช้ความสามารถ 3 เทิร์น ถูกระบบแบนออกจากเกม!`);
            } else if (currentPlayer.coin >= 10) {
                autoCoup(io, game_id);
                if (currentPlayer.coin > 0) currentPlayer.coin -= 1;
                addHistory(io, game, game_id, `${currentPlayer.player_name}: ไม่ใช้โค่นอำนาจถูกลงโทษหัก 1 เหรียญ`);
                return;
            } else if (currentPlayer.coin > 0) {
                currentPlayer.coin -= 1;
                addHistory(io, game, game_id, `${currentPlayer.player_name}: ไม่ใช้ความสามารถถูกลงโทษหัก 1 เหรียญ`);
            }
            stopTurnTimer(game_id);
            nextPlayerTurn(io, game_id);
        }
    }, 1000);

    activeIntervals[game_id] = interval;
};

const stopTurnTimer = (game_id) => {
    if (activeIntervals[game_id]) {
        clearInterval(activeIntervals[game_id]);
        delete activeIntervals[game_id];
    }
};

const startPopupTimer = (io, game_id, callback) => {
    stopPopupTimer(game_id);

    const game = activeGames[game_id];
    if (!game) return;

    game.state.popupTime = game.state.defaultPopupTime;
    game.state.passedPlayers = [];
    game.state.playerDropCard = {};
    game.state.exchangeProcessing = false;
    game.state.playerDropCard.processing = false;

    io.to(game_id).emit("updateGame", game);

    const popupInterval = setInterval(() => {
        if (!game) {
            stopPopupTimer(game_id);
            return;
        }

        game.state.popupTime -= 1;
        io.to(game_id).emit("updateGame", game);
        let alivePlayers;
        if (!game.state?.currentAction?.blocked && game.state?.currentAction?.secondPhase) {
            alivePlayers = [0];
        } else {
            alivePlayers = game.players.filter(p => p.status === "alive" && p.user_id !== game.state.currentTurn);
        }
        if (game.state.popupTime <= 0 || game.state.passedPlayers.length === alivePlayers.length) {
            if (game.state.lastChallenger && !game.state.playerDropCard?.user_id) {
                autoShowCard(io, game_id);
            } else if (game.state.playerDropCard?.user_id) {
                autoDropCard(io, game_id);
            } else {
                stopPopupTimer(game_id);
                game.state.popupTime = 0;
                callback();
            }
        }
    }, 1000);

    activeIntervals[`${game_id}_popup`] = popupInterval;
};

const stopPopupTimer = (game_id) => {
    if (activeIntervals[`${game_id}_popup`]) {
        clearInterval(activeIntervals[`${game_id}_popup`]);
        delete activeIntervals[`${game_id}_popup`];
    }
};

const startVoteTimer = async (io, game_id) => {
    stopVoteTimer(game_id);

    const game = activeGames[game_id];
    if (!game) return;

    game.state.voteTimer = game.state.defaultPopupTime;
    game.state.passedPlayers = [];
    const room_id = game.room_id;
    io.to(game_id).emit("updateGame", game);

    const voteInterval = setInterval(async () => {
        if (!game) {
            stopVoteTimer(game_id);
            return;
        }

        game.state.voteTimer -= 1;
        io.to(game_id).emit("updateGame", game);

        const winner = game.players.find(p => p.isWin === true);
        const losers = game.players.filter(p => p.isWin === false);

        if (game.state.passedPlayers.length === game.players.length) {
            stopVoteTimer(game_id);
            stopTurnTimer(game_id);
            stopPopupTimer(game_id);
            stopExchangeTimer(game_id);
            stopAssassinateTimer(game_id);

            await updateRoomEndGame(room_id);
            await updateFinishedGame(game_id);
            await updateStatWin(winner.user_id);

            for (const player of losers) {
                await updateStatLose(player.user_id);
            }

            const { newRoomId, newGameId } = await insertNewGame(winner, game.players);

            io.to(game_id).emit("redirectToNewGame", { room_id: newRoomId, game_id: newGameId });

            delete activeGames[game_id];
        } else if (game.state.voteTimer <= 0) {
            stopVoteTimer(game_id);
            stopTurnTimer(game_id);
            stopPopupTimer(game_id);
            stopExchangeTimer(game_id);
            stopAssassinateTimer(game_id);


            await updateRoomEndGame(room_id);
            await updateFinishedGame(game_id);
            await updateStatWin(winner.user_id);

            for (const player of losers) {
                await updateStatLose(player.user_id);
            }

            io.to(game_id).emit("redirectToHomepage");

            delete activeGames[game_id];
        }
    }, 1000);

    activeIntervals[`${game_id}_vote`] = voteInterval;
};

const stopVoteTimer = (game_id) => {
    if (activeIntervals[`${game_id}_vote`]) {
        clearInterval(activeIntervals[`${game_id}_vote`]);
        delete activeIntervals[`${game_id}_vote`];
    }
};

const startAssassinateTimer = (io, game_id, callback) => {
    stopAssassinateTimer(game_id);

    const game = activeGames[game_id];
    if (!game) return;

    game.state.assassinateTime = game.state.defaultPopupTime;
    io.to(game_id).emit("updateGame", game);

    const assassinateInterval = setInterval(() => {
        if (!game) {
            clearInterval(assassinateInterval);
            return;
        }

        game.state.assassinateTime -= 1;
        io.to(game_id).emit("updateGame", game);

        if (game.state.assassinateTime > 0) {
            callback();
        } else {
            stopAssassinateTimer(game_id);
            autoDropCard(io, game_id);
        }
    }, 1000);

    activeIntervals[`${game_id}_assassinate`] = assassinateInterval;
};

const stopAssassinateTimer = (game_id) => {
    if (activeIntervals[`${game_id}_assassinate`]) {
        clearInterval(activeIntervals[`${game_id}_assassinate`]);
        delete activeIntervals[`${game_id}_assassinate`];
    }
};

const startExchangeTimer = (io, game_id, drawnCards, callback) => {
    stopExchangeTimer(game_id);

    const game = activeGames[game_id];
    if (!game) return;

    game.state.exchangeTime = game.state.defaultPopupTime;
    io.to(game_id).emit("updateGame", game);

    const exchangeInterval = setInterval(() => {
        if (!game) {
            clearInterval(exchangeInterval);
            return;
        }

        game.state.exchangeTime -= 1;
        io.to(game_id).emit("updateGame", game);

        if (game.state.exchangeTime > 0) {
            callback();
        } else {
            stopExchangeTimer(game_id);
            autoSelectedCard(io, game_id, drawnCards);
        }
    }, 1000);

    activeIntervals[`${game_id}_exchange`] = exchangeInterval;
};

const stopExchangeTimer = (game_id) => {
    if (activeIntervals[`${game_id}_exchange`]) {
        clearInterval(activeIntervals[`${game_id}_exchange`]);
        delete activeIntervals[`${game_id}_exchange`];
    }
};

const autoCoup = (io, game_id) => {
    const game = activeGames[game_id];
    if (!game) return;

    const currentUser = game.players.find(p => p.user_id === game.state.currentTurn);
    const alivePlayers = game.players.filter(p => p.status === "alive" && p.user_id !== game.state.currentTurn);
    if (!currentUser || alivePlayers.length === 0) return;

    const targetPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

    addHistory(io, game, game_id, `${currentUser.player_name}: หมดเวลา! ระบบสุ่มโค่นอำนาจผู้เล่น ${targetPlayer.player_name}`);
    io.to(game_id).emit("autoCoup", { game_id, user_id: currentUser.user_id, target_id: targetPlayer.user_id });
};

const autoShowCard = (io, game_id) => {
    const game = activeGames[game_id];
    if (!game) return;

    const targetPlayer = game.players.find(p => p.user_id === game.state.currentAction?.user_id);
    if (!targetPlayer || targetPlayer.cards.length === 0) return;

    const randomCard = targetPlayer.cards[Math.floor(Math.random() * targetPlayer.cards.length)];

    addHistory(io, game, game_id, `${targetPlayer.player_name}: หมดเวลา! ระบบสุ่มแสดงการ์ด ${randomCard}`);
    io.to(game_id).emit("autoShowCard", { game_id, user_id: targetPlayer.user_id, selectedCard: randomCard, });
};

const autoDropCard = (io, game_id) => {
    const game = activeGames[game_id];
    if (!game) return;

    const targetPlayer = game.players.find(p => p.user_id === game.state.playerDropCard?.user_id);
    if (!targetPlayer || targetPlayer.cards.length === 0) return;

    const randomCard = targetPlayer.cards[Math.floor(Math.random() * targetPlayer.cards.length)];

    addHistory(io, game, game_id, `${targetPlayer.player_name}: หมดเวลา! ระบบสุ่มทิ้งการ์ด ${randomCard}`);
    io.to(game_id).emit("autoDropCard", { game_id, user_id: targetPlayer.user_id, card: randomCard });
};

const autoSelectedCard = (io, game_id, drawnCards) => {
    const game = activeGames[game_id];
    if (!game) return;

    const currentPlayer = game.players.find(p => p.user_id === game.state.currentTurn);
    if (!currentPlayer || currentPlayer.cards.length === 0) return;

    const availableCards = [...currentPlayer.cards, ...drawnCards];
    const selectedCards = [];

    while (selectedCards.length < currentPlayer.cards.length) {
        const randomIndex = Math.floor(Math.random() * availableCards.length);
        selectedCards.push(availableCards[randomIndex]);
        availableCards.splice(randomIndex, 1);
    }
    addHistory(io, game, game_id, `${currentPlayer.player_name}: หมดเวลา! ระบบสุ่มเลือกการ์ดให้ผู้เล่น`);
    io.to(game_id).emit("autoSelectedCard", { game_id, user_id: currentPlayer.user_id, selectedCards, drawnCards });
};

const addHistory = (io, game, game_id, message) => {
    if (!game.history) game.history = [];
    game.history.push(message);
    if (game.history.length > 5) game.history = game.history.slice(-5);
    io.to(game_id).emit("receiveGameHistory", message);
};

const nextPlayerTurn = async (io, game_id) => {
    if (!activeGames[game_id]) return;

    const game = activeGames[game_id];
    const alivePlayers = game.players.filter(player => player.status === "alive");

    if (alivePlayers.length === 1) {
        game.state.gameFinished = alivePlayers[0].player_name;
        addHistory(io, game, game_id, `${alivePlayers[0].player_name}: เป็นผู้ชนะ!`);
        alivePlayers[0].isWin = true;
        delete game.state.currentAction;
        game.state.passedPlayers = [];
        stopTurnTimer(game_id);
        if (game.players.length === 1) {
            stopVoteTimer(game_id);
            stopTurnTimer(game_id);
            stopPopupTimer(game_id);
            stopExchangeTimer(game_id);
            stopAssassinateTimer(game_id);

            await updateRoomEndGame(game.room_id);
            await updateFinishedGame(game_id);
            await updateStatWin(alivePlayers[0].user_id);

            io.to(onlineUsers[alivePlayers[0].user_id]).emit("redirectToHomepage");

            delete activeGames[game_id];
        } else {
            io.to(game_id).emit("updateGame", game);
            startVoteTimer(io, game_id);
        }
        return;
    }

    let currentIndex = game.state?.currentIndex?.status ? game.state?.currentIndex?.index : alivePlayers.findIndex(p => p.user_id === game.state.currentTurn);
    if (currentIndex >= alivePlayers.length) {
        currentIndex = 0;
    }

    const nextIndex = (currentIndex + 1) % alivePlayers.length;
    const nextPlayer = alivePlayers[nextIndex];

    game.state.currentTurn = nextPlayer.user_id;
    game.state.timeTurn = game.state.defaultTimeTurn;
    delete game.state.currentIndex;
    delete game.state.currentAction;

    io.to(game_id).emit("updateGame", game);
    startTurnTimer(io, game_id);
};

const startCountdownTimer = (io, room_id) => {
    stopCountdownTimer(room_id);

    if (activeIntervals[`countdown_${room_id}`]) return;

    let timeLeft = 15;
    if (activeIntervals[`countdown_${room_id}_time`]) {
        timeLeft = activeIntervals[`countdown_${room_id}_time`];
    }
    io.to(room_id).emit("countdownUpdate", { timeLeft });
    const countdownInterval = setInterval(() => {
        timeLeft -= 1;
        activeIntervals[`countdown_${room_id}_time`] = timeLeft;
        io.to(room_id).emit("countdownUpdate", { timeLeft });

        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            delete activeIntervals[`countdown_${room_id}`];
            io.to(room_id).emit("countdownFinished");
        }
    }, 1000);

    activeIntervals[`countdown_${room_id}`] = countdownInterval;
};

const stopCountdownTimer = (room_id) => {
    if (activeIntervals[`countdown_${room_id}`]) {
        clearInterval(activeIntervals[`countdown_${room_id}`]);
        delete activeIntervals[`countdown_${room_id}`];
        delete activeIntervals[`countdown_${room_id}_time`];
    }
};

module.exports = { socketioMiddleware, updateRoomPlayer, onlineUsers, statusUsers };