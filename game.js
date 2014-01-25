var DOWN = 0,
    UP = 1

function makeButton(id) {
    var button = { state: UP, element: el(id) },
        onMouseDown = function() { button.state = DOWN },
        onMouseUp =   function() { button.state = UP   }

    button.element.addEventListener('mousedown', onMouseDown)
    button.element.addEventListener('mouseup',   onMouseUp)
    return button
};

var playerColours = ['red', 'blue', 'green', 'orange', 'purple', 'black']

var distanceBetween = function(point1, point2) {
    var xDiff = point1.x - point2.x,
        yDiff = point1.y - point2.y
    return Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2))
}

var Game = function(players, tanksPerPlayer) {
    this.players = players
    this.tanksPerPlayer = tanksPerPlayer
    this.height = 480
    this.width = 640
    this.canvas = el('canvas')
    this.deleted = false

    var field = new Field(this.width, this.height),
        width = this.width

    this.field = field

    for (var playerId = 0; playerId < players; playerId++) {
        for (var i = 0; i < tanksPerPlayer; i++) {
            var initialX = Math.floor(Math.random() * width),
                tank = new Tank(initialX, playerId, field)
            field.addTank(tank)
        }
    }

    this.field.start()

    this.step = function() {
        this.handleEvents()
        this.update()
        this.draw()

        if (this.deleted) {
            cancelAnimationFrame(this.animationRequest)
        }
    }

    this.start = function() {
        var me = this,
            step = function() {
                me.animationRequest = requestAnimationFrame(step)
                me.step()
            }
        step()
    }

    this.handleEvents = function() {
        this.field.handleEvents()
    }

    this.update = function() {
        this.field.update()
    }

    this.draw = function() {
        var context = this.canvas.getContext("2d")
        context.clearRect(0, 0, this.width, this.height)
        this.field.draw(context)
    }

    this.scheduleDeletion = function() {
        this.deleted = true
    }
}

// we don't store a y value because the Field takes care of that for us
var Tank = function(x, player, field) {
    var START_HEALTH = 100,
        START_FUEL = 100,
        START_TICKS_TO_DISPLAY_ARROW = 60,
        BARREL_ROTATE_SPEED = 0.05

    this.x = x
    this.player = player
    this.field = field
    this.health = START_HEALTH
    this.fuel = START_FUEL
    this.fired = false
    this.projectile = null
    this.takenTurn = false
    this.destroyed = false

    // speed in pixels/tick
    this.speed = 0.75

    // 0 is facing right, rotating clockwise is increasing
    this.barrelAngle = 1.5*Math.PI

    // for drawing
    this.radius = 5

    this.mayMove = function() {
        return this.fuel > 0
    }

    this.mayFire = function() {
        return !(this.fired)
    }

    this.fire = function() {
        this.fired = true
        // can't move after firing
        this.fuel = 0

        var projectileSpeed = 10
        this.projectile = new Projectile(
                this.x,
                this.field.heightAt(this.x),
                this.barrelAngle,
                projectileSpeed,
                this.field
                )
    }

    // the turn is over if:
    //  tank has already fired this turn
    //  projectile is null (has landed and exploded)
    this.finishedTurn = function() {
        if (this.fired) {
            return this.projectile === null
        } else {
            return false
        }
    }

    // should get called at the end of each turn
    this.endTurn = function() {
        this.fuel = START_FUEL
        this.fired = false
        this.takenTurn = true
        this.ticksToDisplayArrow = 0
    }

    this.startTurn = function() {
        this.ticksToDisplayArrow = START_TICKS_TO_DISPLAY_ARROW
    }

    this.update = function() {
        if (this.ticksToDisplayArrow > 0) {
            this.ticksToDisplayArrow--
        }

        if (this.mayMove()) {
            if (Buttons.moveLeft.state === DOWN && this.x > 0) {
                this.fuel--
                this.x--
            } else if (Buttons.moveRight.state === DOWN && this.x < (field.width-1)) {
                this.fuel--
                this.x++
            }

        }

        if (this.mayFire()) {
            if (Buttons.fire.state === DOWN) {
                // hack: reset state to UP even though it's DOWN so that the
                // next player doesn't also accidentally fire
                this.fire()
                Buttons.fire.state = UP
            }

            if (Buttons.aimLeft.state === DOWN && this.barrelAngle > Math.PI) {
                this.barrelAngle -= BARREL_ROTATE_SPEED
            } else if (Buttons.aimRight.state === DOWN && this.barrelAngle < 2*Math.PI) {
                this.barrelAngle += BARREL_ROTATE_SPEED
            }
        }

        if (this.projectile) {
            this.projectile.update()
            if (this.projectile.finishedExploding) {
                this.projectile = null
            }
        }
    }

    this.draw = function(context, y) {
        if (this.destroyed) { return }
        var style = playerColours[this.player]

        // draw body
        context.beginPath()
        context.arc(this.x, y, this.radius, 0, 2*Math.PI, false)
        context.fillStyle = style
        context.fill()

        // draw barrel
        var barrelLength = 10,
            barrelX = this.x + (barrelLength * Math.cos(this.barrelAngle)),
            barrelY = y      + (barrelLength * Math.sin(this.barrelAngle))
        context.beginPath()
        context.moveTo(this.x, y)
        context.lineTo(barrelX, barrelY)
        context.strokeStyle = style
        context.stroke()

        // draw arrow indicating whose turn it is
        if (this.ticksToDisplayArrow > 0) {
            context.drawImage(Images.downArrow, this.x - 8, y - 45)

        // draw healthbar
        } else {
            var HEALTHBAR_WIDTH = 30,
                HEALTHBAR_HEIGHT = 5,
                healthbarX = this.x - (HEALTHBAR_WIDTH / 2),
                healthbarY = y - 45,
                fillStyle

            if (this.health > 66) {
                fillStyle = 'green'
            } else if (this.health > 33) {
                fillStyle = 'orange'
            } else {
                fillStyle = 'red'
            }

            // draw healthbar
            context.beginPath()
            context.rect(healthbarX, healthbarY,
                    HEALTHBAR_WIDTH * (this.health / 100) , HEALTHBAR_HEIGHT)
            context.fillStyle = fillStyle
            context.fill()
            // draw healthbar container
            context.beginPath()
            context.rect(healthbarX, healthbarY,
                    HEALTHBAR_WIDTH, HEALTHBAR_HEIGHT)
            context.strokeStyle = 'black'
            context.stroke()
        }
    }
}

// a projectile, which falls under gravity until it hits the ground
var Projectile = function(x, y, angle, speed, field) {
    // pixels/sec^2
    var GRAVITY = 0.25,
        EXPLOSION_LENGTH = 30,
        MAX_BLAST_RADIUS = 30,
        BLAST_CONSTANT = (MAX_BLAST_RADIUS / Math.pow(EXPLOSION_LENGTH / 2, 2)),
        DAMAGE_RATIO = 2

    this.x = x
    this.y = y
    this.xspeed = speed * Math.cos(angle)
    this.yspeed = speed * Math.sin(angle)
    this.field = field
    this.explodingTicks = 0
    this.finishedExploding = false

    // for drawing
    this.radius = 3

    this.landed = function() {
        groundLevel = this.field.heightAt(this.x)
        return groundLevel <= this.y
    }

    this.explode = function() {
        this.explodingTicks = EXPLOSION_LENGTH

        // damage surrounding tanks
        var tanks = this.field.getTankLocations()
        for (var tankId = 0; tankId < tanks.length; tankId++) {
            var tank = tanks[tankId],
                distance = distanceBetween(this, tank),
                damage = DAMAGE_RATIO * Math.max(MAX_BLAST_RADIUS - distance, 0)

            var actualTank = this.field.tanks[tankId]
            if (actualTank.health > damage) {
                actualTank.health -= damage
            } else {
                this.field.destroyTankById(tankId)
            }
        }
    }

    this.isExploding = function() {
        return this.explodingTicks > 0
    }

    // for drawing -- the visible size of the explosion
    // quadratic function of time left to explode
    // should start at 0, rise, and fall back to 0 after EXPLOSION_LENGTH ticks
    // should peak at MAX_BLAST_RADIUS
    this.blastRadius = function() {
        var linearTerm = this.explodingTicks * EXPLOSION_LENGTH,
            quadraticTerm = Math.pow(this.explodingTicks, 2),
            result = linearTerm - quadraticTerm
        return BLAST_CONSTANT * result
    }

    this.update = function() {
        if (this.isExploding()) {
            this.explodingTicks--
            if (this.explodingTicks === 0) {
                this.finishedExploding = true
            }
        } else {
            this.yspeed += GRAVITY
            this.x += this.xspeed
            this.y += this.yspeed

            if (this.landed()) {
                this.y = this.field.heightAt(this.x)
                this.explode()
            }
        }
    }

    this.draw = function(context) {
        if (this.isExploding()) {
            context.beginPath()
            context.arc(this.x, this.y, this.blastRadius(), 0, 2*Math.PI, false)
            context.fillStyle = 'orange'
            context.fill()

        } else {
            context.beginPath()
            context.arc(this.x, this.y, this.radius, 0, 2*Math.PI, false)
            context.fillStyle = 'black'
            context.fill()
        }
    }
}

var Field = function(width, height) {
    var level

    this.width = width
    this.tanks = []
    this.players = 0

    // the tank which is currently being controlled
    this.currentTankId = undefined

    // generate the heights
    // this will contain one element at each x value
    // start at halfway up the map
    var startHeight = Math.floor(height * (0.6 * Math.random() + 0.4)),
        level = [startHeight]
    for (var i = 1; i < width; i++) {
        var rand = Math.random(),
            prev = level[0]

        // make sure we're not too high
        if (rand < 0.3 && prev < (height - 10)) {
            // go up with p 0.3
            level.unshift(prev + 1)

        // make sure we don't go too low
        } else if (rand > 0.7 && prev > 10) {
            // go down with p 0.3
            level.unshift(prev - 1)

        } else {
            // stay the same with p 0.4
            level.unshift(prev)
        }
    }
    this.level = level

    this.heightAt = function(x) {
        var xVal = Math.floor(x)

        // assume flat either side of visible area
        if (xVal < 0) { xVal = 0 }
        if (xVal > (this.width-1)) { xVal = this.width - 1 }

        return this.level[xVal]
    }

    // get the locations of all the tanks
    this.getTankLocations = function() {
        var locations = []
        for (var tankId = 0; tankId < this.tanks.length; tankId++) {
            var tank = this.tanks[tankId]
            locations.push({
                x:  tank.x,
                y:  this.heightAt(tank.x)
            })
        }
        return locations
    }

    // call this directly after adding all the tanks
    this.start = function() {
        this.currentTankId = 0
        this.getCurrentTank().startTurn()
    }

    this.addTank = function(tank) {
        // add the tank
        this.tanks.push(tank)

        // update number of players
        if (this.players < (tank.player + 1)) {
            this.players++
        }
    }

    // sets all tanks to not having had their turn
    this.resetTurns = function() {
        this.tanks.forEach(function(tank) {
            tank.takenTurn = false
        })
    }

    this.getCurrentTank = function() {
        return this.tanks[this.currentTankId]
    }

    this.getCurrentPlayer = function() {
        return this.getCurrentTank().player
    }

    this.getRemainingPlayers = function() {
        var players = this.tanks.filter(function(tank) {
            return !tank.destroyed
        }).map(function(tank) {
            return tank.player
        }),
            uniquePlayers = []
        players.forEach(function(player) {
            if (uniquePlayers.indexOf(player) === -1) {
                uniquePlayers.push(player)
            }
        })
        return uniquePlayers
    }

    this.getNextPlayer = function() {
        var remainingPlayers = this.getRemainingPlayers(),
            candidatePlayer = (this.getCurrentPlayer() + 1) % this.players,
            initialPlayer = candidatePlayer

        while (remainingPlayers.indexOf(candidatePlayer) === -1) {
            candidatePlayer = (candidatePlayer + 1) % this.players
            if (candidatePlayer === initialPlayer) {
                throw new Error("BUG: no players available")
            }
        }
        return candidatePlayer
    }

    this.setNextTank = function() {
        var nextPlayer = this.getNextPlayer(),
            tanks = this.tanks.filter(function(tank) {
                return tank.player === nextPlayer && !tank.destroyed
            }),
            takenTurn = function(tank) { return tank.takenTurn }

        if (tanks.every(takenTurn)) {
            // reset all tanks for this player to not having taken a turn
            tanks.forEach(function(tank) {
                tank.takenTurn = false
            })
        }

        var notTakenTurn = function(tank) { return !tank.takenTurn },
            candidateTanks = tanks.filter(notTakenTurn),
            nextTankId = this.tanks.indexOf(candidateTanks[0])

        if (this.tanks[nextTankId]) {
            this.currentTankId = nextTankId
        } else {
            throw new Error("BUG: nextTankId is " +
                    nextTankId + ", no tank with that id exists")
        }
    }

    this.destroyTankById = function(tankId) {
        this.tanks[tankId].destroyed = true
    }

    this.isGameOver = function() {
        var remaining = function(tank) { return !(tank.destroyed) },
            remainingTanks = this.tanks.filter(remaining)

        // if all tanks have been destroyed, end the game
        if (remainingTanks.length === 0) {
            prettyAlert("Nobody wins. Such is war...")
            return true
        }

        var firstPlayer = remainingTanks[0].player,
            belongsToFirst = function(tank) {
                return tank.player === firstPlayer
            }

        // if all the remaining tanks belong to the same player, end the game
        if (remainingTanks.every(belongsToFirst)) {
            prettyAlert("The " + playerColours[firstPlayer] + " player wins!")
            return true
        }
        return false
    }

    this.handleEvents = function() {
        var tank = this.getCurrentTank()

        if (tank.finishedTurn()) {
            tank.endTurn()
            this.setNextTank()
            this.getCurrentTank().startTurn()
        }
    }

    this.update = function() {
        if (this.isGameOver()) {
            window.game.scheduleDeletion()
        } else {
            var tank = this.getCurrentTank()
            tank.update()
        }
    }

    // assumes that the Field and the Canvas have the same dimensions
    this.draw = function(context) {
        context.beginPath()
        context.moveTo(0, this.level[0])
        for (var i = 0; i < this.width; i += 3) {
            context.lineTo(i, this.level[i])
        }
        context.strokeStyle = 'black'
        context.stroke()

        for (var i = 0; i < this.tanks.length; i++) {
            var tank = this.tanks[i]
            // subtract 5 so that it looks like the tank is on the ground
            // rather than in it
            var y = this.level[tank.x] - 5
            tank.draw(context, y)
        }

        var proj = this.getCurrentTank().projectile
        if (proj) {
            proj.draw(context)
        }
    }
}

function hideElem(elem) {
    elem.style.display = "none";
}

function showElem(elem, display) {
    if (display == null) { display = "block" }
    elem.style.display = display
}

var el = document.getElementById.bind(document)

function initPrompts() {
    var input    = el('prompt-box-input'),
        okButton = el('prompt-box-ok-button')

    input.addEventListener('keyup', function(ev) {
        if (ev.keyCode === 13) {
            okButton.click()
        }
    })
}

function prettyPrompt(questionText, validator, nextAction) {
    var promptBox       = el('prompt-box'),
        question        = el('prompt-box-question'),
        input           = el('prompt-box-input'),
        okButton        = el('prompt-box-ok-button'),
        validationError = el('prompt-box-validation-error')

    if (validator == null) {
        validator = function(val) { return { valid: true, value: val } }
    }

    showElem(promptBox)
    question.innerHTML = questionText
    input.focus()

    okButton.onclick = function() {
        hideElem(validationError)
        var val = input.value
        res = validator(val)

        if (res.valid === true) {
            hideElem(promptBox)
            question.innerHTML = ""
            input.value = ""
            nextAction(res.value)
        } else {
            wobble(promptBox)
            showElem(validationError)
            validationError.innerHTML = res.message
        }
    }
}

function wobble(elem) {
    elem.classList.add('wobbling')
    setTimeout(function() {
        elem.classList.remove('wobbling')
    }, 500)
}

function prettyAlert(messageText, nextAction) {
    var alertBox = el('alert-box')
        message  = el('alert-box-message')
        okButton = el('alert-box-ok-button')

    showElem(alertBox)
    message.innerHTML = messageText
    okButton.focus()

    okButton.onclick = function() {
        hideElem(alertBox)
        message.innerHTML = ""
        nextAction()
    }
}

window.onload = function() {
    initPrompts()

    var loadImage = function(src) {
            var img = new Image()
            img.src = src
            return img
        }

    // load buttons
    this.Buttons = {
        moveLeft: makeButton('move-left'),
        moveRight: makeButton('move-right'),
        aimLeft: makeButton('aim-left'),
        aimRight: makeButton('aim-right'),
        fire: makeButton('fire')
    }

    // load images
    this.Images = {
        downArrow: loadImage('down-arrow.png')
    }

    var validatePlayers = function(playersText) {
        var players = parseInt(playersText)
        if (isNaN(players)) {
            return {
                valid: false,
                message: "Please enter a number."
            }
        }
        if (players < 2) {
            return {
                valid: false,
                message: "There must be at least two players."
            }
        }
        return {
            valid: true,
            value: players
        }
    }

    var validateTanks = function(tanksText) {
        var tanks = parseInt(tanksText)
        if (isNaN(tanks)) {
            return {
                valid: false,
                message: "Please enter a number."
            }
        }
        if (tanks < 1) {
            return {
                valid: false,
                message: "There must be at least one tank per player"
            }
        }
        return {
            valid: true,
            value: tanks
        }
    }

    // set click handler for game starting button
    el('new-game').onclick = function() {
        if (this.game === undefined || this.game.deleted) {
            prettyPrompt("How many players? Enter at least 2.",
                    validatePlayers,
                    function(players) {
                        prettyPrompt("how many tanks each?",
                            validateTanks,
                            function(tanks) {
                                window.game = new Game(players, tanks)
                                window.game.start()
                            })
                    })
        }
    }
}
