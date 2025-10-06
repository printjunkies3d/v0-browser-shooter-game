"use client"

import { useEffect, useRef, useState } from "react"
import { GameHUD } from "./game-hud"
import { MiniMap } from "./mini-map"

interface Player {
  x: number
  y: number
  angle: number
  health: number
  maxHealth: number
  ammo: number
  kills: number
  speed: number
  currency: number
}

interface Enemy {
  x: number
  y: number
  health: number
  maxHealth: number
  speed: number
  angle: number
  id: number
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  id: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  id: number
}

interface Drop {
  x: number
  y: number
  type: "ammo" | "money" | "powerup"
  id: number
  size: number
  spawnTime: number // Added spawn time to track drop lifetime
}

interface BuyStation {
  x: number
  y: number
  type: "ammo" | "health"
  cost: number
  size: number
}

interface Wall {
  x: number
  y: number
  width: number
  height: number
}

interface Door {
  x: number
  y: number
  width: number
  height: number
  cost: number
  isOpen: boolean
  id: number
}

const WORLD_WIDTH = 3000
const WORLD_HEIGHT = 2000
const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800
const PLAYER_SIZE = 16
const ENEMY_SIZE = 16
const BULLET_SIZE = 4
const ENEMY_SPAWN_INTERVAL = 2000
const MAX_ENEMIES = 15
const BUY_STATION_SIZE = 40
const AMMO_COST = 50
const HEALTH_COST = 75
const DROP_SIZE = 12

export default function TopDownShooter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [showSettings, setShowSettings] = useState(false) // Added settings state
  const [buyPrompt, setBuyPrompt] = useState<{ type: string; cost: number } | null>(null)
  const [doorPrompt, setDoorPrompt] = useState<{ cost: number } | null>(null)
  const [minimapUpdate, setMinimapUpdate] = useState(0)
  const [controllerConnected, setControllerConnected] = useState(false) // Track controller connection

  const gameStateRef = useRef({
    player: {
      x: 200,
      y: WORLD_HEIGHT / 2,
      angle: 0,
      health: 100,
      maxHealth: 100,
      ammo: 35,
      kills: 0,
      speed: 3,
      currency: 100,
    } as Player,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    drops: [] as Drop[],
    buyStations: [
      { x: 250, y: WORLD_HEIGHT / 2, type: "ammo" as const, cost: AMMO_COST, size: BUY_STATION_SIZE },
      { x: 800, y: 300, type: "health" as const, cost: HEALTH_COST, size: BUY_STATION_SIZE },
      { x: 1800, y: 1400, type: "ammo" as const, cost: AMMO_COST, size: BUY_STATION_SIZE },
      { x: 2600, y: 800, type: "health" as const, cost: HEALTH_COST, size: BUY_STATION_SIZE },
    ] as BuyStation[],
    walls: [
      // Outer walls
      { x: 0, y: 0, width: WORLD_WIDTH, height: 20 },
      { x: 0, y: WORLD_HEIGHT - 20, width: WORLD_WIDTH, height: 20 },
      { x: 0, y: 0, width: 20, height: WORLD_HEIGHT },
      { x: WORLD_WIDTH - 20, y: 0, width: 20, height: WORLD_HEIGHT },

      // Room dividers - creating multiple areas
      { x: 600, y: 20, width: 20, height: 500 },
      { x: 600, y: 700, width: 20, height: 1280 },
      { x: 620, y: 600, width: 580, height: 20 },
      { x: 1400, y: 600, width: 380, height: 20 },
      { x: 1780, y: 20, width: 20, height: 580 },
      { x: 1780, y: 900, width: 20, height: 1080 },
      { x: 620, y: 1200, width: 580, height: 20 },
      { x: 1400, y: 1200, width: 380, height: 20 },

      // Interior obstacles
      { x: 300, y: 400, width: 200, height: 20 },
      { x: 900, y: 300, width: 20, height: 200 },
      { x: 1000, y: 1400, width: 200, height: 20 },
      { x: 200, y: 800, width: 300, height: 20 },
      { x: 2200, y: 1200, width: 300, height: 20 },
      { x: 2400, y: 400, width: 20, height: 300 },
    ] as Wall[],
    doors: [
      { x: 600, y: 540, width: 20, height: 140, cost: 100, isOpen: false, id: 0 },
      { x: 1220, y: 600, width: 160, height: 20, cost: 150, isOpen: false, id: 1 },
      { x: 1780, y: 620, width: 20, height: 260, cost: 200, isOpen: false, id: 2 },
      { x: 1220, y: 1200, width: 160, height: 20, cost: 150, isOpen: false, id: 3 },
    ] as Door[],
    keys: {} as Record<string, boolean>,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    lastShot: 0,
    lastEnemySpawn: 0,
    nextEnemyId: 0,
    nextBulletId: 0,
    nextParticleId: 0,
    nextDropId: 0,
    powerupActive: false,
    powerupEndTime: 0,
    gamepadIndex: -1, // Track connected gamepad
    damageFlash: 0,
    screenShake: 0,
    lastHealth: 100,
    cameraX: 0,
    cameraY: 0,
  })

  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log("[v0] Gamepad connected:", e.gamepad.id)
      gameStateRef.current.gamepadIndex = e.gamepad.index
      setControllerConnected(true)
    }

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log("[v0] Gamepad disconnected")
      if (gameStateRef.current.gamepadIndex === e.gamepad.index) {
        gameStateRef.current.gamepadIndex = -1
        setControllerConnected(false)
      }
    }

    window.addEventListener("gamepadconnected", handleGamepadConnected)
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected)

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected)
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected)
    }
  }, [])

  useEffect(() => {
    if (!gameStarted || gameOver) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const state = gameStateRef.current

    const checkWallCollision = (x: number, y: number, size: number): boolean => {
      for (const wall of state.walls) {
        if (
          x + size / 2 > wall.x &&
          x - size / 2 < wall.x + wall.width &&
          y + size / 2 > wall.y &&
          y - size / 2 < wall.y + wall.height
        ) {
          return true
        }
      }

      // Check closed doors
      for (const door of state.doors) {
        if (!door.isOpen) {
          if (
            x + size / 2 > door.x &&
            x - size / 2 < door.x + door.width &&
            y + size / 2 > door.y &&
            y - size / 2 < door.y + door.height
          ) {
            return true
          }
        }
      }

      return false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      state.keys[e.key.toLowerCase()] = true
      if (e.key.toLowerCase() === "e") {
        let doorPurchased = false
        state.doors.forEach((door) => {
          if (!door.isOpen) {
            const dist = Math.sqrt(
              Math.pow(state.player.x - (door.x + door.width / 2), 2) +
                Math.pow(state.player.y - (door.y + door.height / 2), 2),
            )
            if (dist < 50) {
              if (state.player.currency >= door.cost) {
                state.player.currency -= door.cost
                door.isOpen = true
                doorPurchased = true
                createParticles(door.x + door.width / 2, door.y + door.height / 2, 20, "#00ff00")
              }
            }
          }
        })

        if (!doorPurchased) {
          state.buyStations.forEach((station) => {
            const dist = Math.sqrt(Math.pow(state.player.x - station.x, 2) + Math.pow(state.player.y - station.y, 2))
            if (dist < station.size + PLAYER_SIZE) {
              if (state.player.currency >= station.cost) {
                state.player.currency -= station.cost
                if (station.type === "ammo") {
                  state.player.ammo = Math.min(state.player.ammo + 30, 100)
                } else if (station.type === "health") {
                  state.player.health = Math.min(state.player.health + 50, state.player.maxHealth)
                }
              }
            }
          })
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      state.keys[e.key.toLowerCase()] = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      state.mouseX = canvasX + state.cameraX
      state.mouseY = canvasY + state.cameraY
    }

    const handleMouseDown = () => {
      state.mouseDown = true
    }

    const handleMouseUp = () => {
      state.mouseDown = false
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mouseup", handleMouseUp)

    const spawnEnemy = () => {
      if (state.enemies.length >= MAX_ENEMIES) return

      let x = 0,
        y = 0
      let validSpawn = false
      let attempts = 0

      while (!validSpawn && attempts < 50) {
        const angle = Math.random() * Math.PI * 2
        const distance = 400 + Math.random() * 200
        x = state.player.x + Math.cos(angle) * distance
        y = state.player.y + Math.sin(angle) * distance

        // Clamp to world bounds
        x = Math.max(30, Math.min(WORLD_WIDTH - 30, x))
        y = Math.max(30, Math.min(WORLD_HEIGHT - 30, y))

        if (!checkWallCollision(x, y, ENEMY_SIZE)) {
          validSpawn = true
        }
        attempts++
      }

      if (!validSpawn) return

      state.enemies.push({
        x,
        y,
        health: 30,
        maxHealth: 30,
        speed: 1 + Math.random() * 0.5,
        angle: 0,
        id: state.nextEnemyId++,
      })
    }

    const createParticles = (x: number, y: number, count: number, color: string) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 3 + 1
        state.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 30,
          maxLife: 30,
          size: Math.random() * 3 + 2,
          color,
          id: state.nextParticleId++,
        })
      }
    }

    const createDrop = (x: number, y: number, timestamp: number) => {
      const rand = Math.random()
      let dropType: "ammo" | "money" | "powerup"

      if (rand < 0.4) {
        dropType = "ammo"
      } else if (rand < 0.75) {
        dropType = "money"
      } else {
        dropType = "powerup"
      }

      state.drops.push({
        x,
        y,
        type: dropType,
        id: state.nextDropId++,
        size: DROP_SIZE,
        spawnTime: timestamp,
      })
    }

    const gameLoop = (timestamp: number) => {
      const previousHealth = state.lastHealth

      let usingController = false

      if (state.gamepadIndex >= 0) {
        const gamepads = navigator.getGamepads()
        const gamepad = gamepads[state.gamepadIndex]

        if (gamepad) {
          const deadzone = 0.15

          // Left stick for movement
          const leftStickX = gamepad.axes[0]
          const leftStickY = gamepad.axes[1]

          if (Math.abs(leftStickX) > deadzone || Math.abs(leftStickY) > deadzone) {
            const newX = state.player.x + leftStickX * state.player.speed
            const newY = state.player.y + leftStickY * state.player.speed

            if (!checkWallCollision(newX, state.player.y, PLAYER_SIZE)) {
              state.player.x = Math.max(PLAYER_SIZE, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX))
            }
            if (!checkWallCollision(state.player.x, newY, PLAYER_SIZE)) {
              state.player.y = Math.max(PLAYER_SIZE, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY))
            }
          }

          const rightStickX = gamepad.axes[2]
          const rightStickY = gamepad.axes[3]

          if (Math.abs(rightStickX) > deadzone || Math.abs(rightStickY) > deadzone) {
            state.player.angle = Math.atan2(rightStickY, rightStickX)
            usingController = true // Mark that controller is controlling aim
          }

          // Right trigger (RT) for shooting
          const rightTrigger = gamepad.buttons[7]?.value || 0
          if (rightTrigger > 0.5 && state.player.ammo > 0 && timestamp - state.lastShot > 150) {
            const bulletSpeed = 8
            state.bullets.push({
              x: state.player.x,
              y: state.player.y,
              vx: Math.cos(state.player.angle) * bulletSpeed,
              vy: Math.sin(state.player.angle) * bulletSpeed,
              id: state.nextBulletId++,
            })
            state.player.ammo--
            state.lastShot = timestamp
            createParticles(state.player.x, state.player.y, 3, "#ffff00")
          }

          // A button (button 0) for interaction
          if (gamepad.buttons[0]?.pressed) {
            // Check doors
            let doorPurchased = false
            state.doors.forEach((door) => {
              if (!door.isOpen) {
                const dist = Math.sqrt(
                  Math.pow(state.player.x - (door.x + door.width / 2), 2) +
                    Math.pow(state.player.y - (door.y + door.height / 2), 2),
                )
                if (dist < 50) {
                  if (state.player.currency >= door.cost) {
                    state.player.currency -= door.cost
                    door.isOpen = true
                    doorPurchased = true
                    createParticles(door.x + door.width / 2, door.y + door.height / 2, 20, "#00ff00")
                  }
                }
              }
            })

            // Check buy stations
            if (!doorPurchased) {
              state.buyStations.forEach((station) => {
                const dist = Math.sqrt(
                  Math.pow(state.player.x - station.x, 2) + Math.pow(state.player.y - station.y, 2),
                )
                if (dist < station.size + PLAYER_SIZE) {
                  if (state.player.currency >= station.cost) {
                    state.player.currency -= station.cost
                    if (station.type === "ammo") {
                      state.player.ammo = Math.min(state.player.ammo + 30, 100)
                    } else if (station.type === "health") {
                      state.player.health = Math.min(state.player.health + 50, state.player.maxHealth)
                    }
                  }
                }
              })
            }
          }
        }
      }

      if (timestamp - state.lastEnemySpawn > ENEMY_SPAWN_INTERVAL) {
        spawnEnemy()
        state.lastEnemySpawn = timestamp
      }

      if (!usingController) {
        const dx = state.mouseX - state.player.x
        const dy = state.mouseY - state.player.y
        state.player.angle = Math.atan2(dy, dx)
      }

      let newX = state.player.x
      let newY = state.player.y

      if (state.keys["w"]) newY -= state.player.speed
      if (state.keys["s"]) newY += state.player.speed
      if (state.keys["a"]) newX -= state.player.speed
      if (state.keys["d"]) newX += state.player.speed

      if (!checkWallCollision(newX, state.player.y, PLAYER_SIZE)) {
        state.player.x = Math.max(PLAYER_SIZE, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX))
      }
      if (!checkWallCollision(state.player.x, newY, PLAYER_SIZE)) {
        state.player.y = Math.max(PLAYER_SIZE, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY))
      }

      state.cameraX = state.player.x - CANVAS_WIDTH / 2
      state.cameraY = state.player.y - CANVAS_HEIGHT / 2

      // Clamp camera to world bounds
      state.cameraX = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, state.cameraX))
      state.cameraY = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, state.cameraY))

      state.drops = state.drops.filter((drop) => {
        const dropAge = timestamp - drop.spawnTime

        if (dropAge > 7000) {
          return false
        }

        const dist = Math.sqrt(Math.pow(state.player.x - drop.x, 2) + Math.pow(state.player.y - drop.y, 2))
        if (dist < PLAYER_SIZE + drop.size) {
          if (drop.type === "ammo") {
            state.player.ammo = Math.min(state.player.ammo + 15, 100)
            createParticles(drop.x, drop.y, 8, "#ffaa00")
          } else if (drop.type === "money") {
            state.player.currency += 50
            createParticles(drop.x, drop.y, 8, "#00ff00")
          } else if (drop.type === "powerup") {
            state.powerupActive = true
            state.powerupEndTime = timestamp + 5000
            state.player.speed = 5
            createParticles(drop.x, drop.y, 12, "#ff00ff")
          }
          return false
        }
        return true
      })

      state.drops.forEach((drop) => {
        const dropAge = timestamp - drop.spawnTime
        const shouldFlash = dropAge > 4000
        const flashInterval = 200
        const isVisible = !shouldFlash || Math.floor(dropAge / flashInterval) % 2 === 0

        if (isVisible) {
          const glowSize = drop.size + 4
          const gradient = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, glowSize)

          if (drop.type === "ammo") {
            gradient.addColorStop(0, "#ffaa00")
            gradient.addColorStop(1, "rgba(255, 170, 0, 0)")
          } else if (drop.type === "money") {
            gradient.addColorStop(0, "#00ff00")
            gradient.addColorStop(1, "rgba(0, 255, 0, 0)")
          } else {
            gradient.addColorStop(0, "#ff00ff")
            gradient.addColorStop(1, "rgba(255, 0, 255, 0)")
          }

          ctx.fillStyle = gradient
          ctx.fillRect(drop.x - glowSize, drop.y - glowSize, glowSize * 2, glowSize * 2)

          ctx.fillStyle = drop.type === "ammo" ? "#ffdd44" : drop.type === "money" ? "#44ff44" : "#ff44ff"
          ctx.fillRect(drop.x - drop.size / 2, drop.y - drop.size / 2, drop.size, drop.size)

          ctx.fillStyle = "#000000"
          ctx.font = "bold 10px monospace"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(drop.type === "ammo" ? "A" : drop.type === "money" ? "$" : "P", drop.x, drop.y)
        }
      })

      state.bullets.forEach((bullet) => {
        bullet.x += bullet.vx
        bullet.y += bullet.vy
      })

      state.bullets = state.bullets.filter(
        (bullet) => bullet.x > 0 && bullet.x < WORLD_WIDTH && bullet.y > 0 && bullet.y < WORLD_HEIGHT,
      )

      state.bullets = state.bullets.filter((bullet) => {
        let hit = false
        state.enemies = state.enemies.filter((enemy) => {
          const dist = Math.sqrt(Math.pow(bullet.x - enemy.x, 2) + Math.pow(bullet.y - enemy.y, 2))
          if (dist < ENEMY_SIZE) {
            enemy.health -= 10
            hit = true

            createParticles(enemy.x, enemy.y, 5, "#ff0000")

            if (enemy.health <= 0) {
              state.player.kills++
              state.player.currency += 25
              createParticles(enemy.x, enemy.y, 15, "#ff0000")

              if (Math.random() < 0.6) {
                createDrop(enemy.x, enemy.y, timestamp)
              }

              return false
            }
          }
          return true
        })
        return !hit
      })

      state.enemies.forEach((enemy) => {
        const dx = state.player.x - enemy.x
        const dy = state.player.y - enemy.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        enemy.angle = Math.atan2(dy, dx)

        const newX = enemy.x + (dx / dist) * enemy.speed
        const newY = enemy.y + (dy / dist) * enemy.speed

        if (!checkWallCollision(newX, enemy.y, ENEMY_SIZE)) {
          enemy.x = newX
        }
        if (!checkWallCollision(enemy.x, newY, ENEMY_SIZE)) {
          enemy.y = newY
        }

        const playerDist = Math.sqrt(Math.pow(enemy.x - state.player.x, 2) + Math.pow(enemy.y - state.player.y, 2))
        if (playerDist < PLAYER_SIZE + ENEMY_SIZE) {
          state.player.health -= 0.5
          if (state.player.health <= 0) {
            setGameOver(true)
          }
        }
      })

      if (state.player.health < previousHealth) {
        state.damageFlash = 30 // Flash for 30 frames
        state.screenShake = 10 // Shake for 10 frames
      }
      state.lastHealth = state.player.health

      state.particles = state.particles.filter((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vx *= 0.95
        particle.vy *= 0.95
        particle.life--
        return particle.life > 0
      })

      if (state.powerupActive && timestamp > state.powerupEndTime) {
        state.powerupActive = false
        state.player.speed = 3
      }

      let shakeX = 0
      let shakeY = 0
      if (state.screenShake > 0) {
        shakeX = (Math.random() - 0.5) * state.screenShake
        shakeY = (Math.random() - 0.5) * state.screenShake
        state.screenShake--
      }

      ctx.save()
      ctx.translate(-state.cameraX + shakeX, -state.cameraY + shakeY)

      ctx.fillStyle = "#0a0f0a"
      // ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.fillRect(state.cameraX, state.cameraY, CANVAS_WIDTH, CANVAS_HEIGHT)

      ctx.strokeStyle = "#1a2f1a"
      ctx.lineWidth = 1
      const gridSize = 40
      const startX = Math.floor(state.cameraX / gridSize) * gridSize
      const startY = Math.floor(state.cameraY / gridSize) * gridSize
      for (let x = startX; x < state.cameraX + CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, state.cameraY)
        ctx.lineTo(x, state.cameraY + CANVAS_HEIGHT)
        ctx.stroke()
      }
      for (let y = startY; y < state.cameraY + CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(state.cameraX, y)
        ctx.lineTo(state.cameraX + CANVAS_WIDTH, y)
        ctx.stroke()
      }

      ctx.fillStyle = "#2a3a2a"
      state.walls.forEach((wall) => {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height)

        ctx.strokeStyle = "#3a4a3a"
        ctx.lineWidth = 2
        ctx.strokeRect(wall.x, wall.y, wall.width, wall.height)
      })

      state.doors.forEach((door) => {
        if (door.isOpen) {
          ctx.strokeStyle = "#00ff88"
          ctx.lineWidth = 2
          ctx.strokeRect(door.x, door.y, door.width, door.height)
        } else {
          ctx.fillStyle = "#ff8800"
          ctx.fillRect(door.x, door.y, door.width, door.height)

          ctx.strokeStyle = "#ffaa44"
          ctx.lineWidth = 3
          ctx.strokeRect(door.x, door.y, door.width, door.height)

          ctx.fillStyle = "#ffffff"
          ctx.font = "bold 14px monospace"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(`$${door.cost}`, door.x + door.width / 2, door.y + door.height / 2)
        }
      })

      state.buyStations.forEach((station) => {
        ctx.fillStyle = station.type === "ammo" ? "#ffaa00" : "#00ff88"
        ctx.fillRect(station.x - station.size / 2, station.y - station.size / 2, station.size, station.size)

        ctx.strokeStyle = station.type === "ammo" ? "#ffdd44" : "#44ffaa"
        ctx.lineWidth = 3
        ctx.strokeRect(station.x - station.size / 2, station.y - station.size / 2, station.size, station.size)

        ctx.fillStyle = "#000000"
        ctx.font = "bold 20px monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(station.type === "ammo" ? "A" : "H", station.x, station.y)

        ctx.fillStyle = "#ffffff"
        ctx.font = "12px monospace"
        ctx.fillText(`$${station.cost}`, station.x, station.y + station.size / 2 + 15)
      })

      state.bullets.forEach((bullet) => {
        ctx.fillStyle = "#ffff00"
        ctx.fillRect(bullet.x - BULLET_SIZE / 2, bullet.y - BULLET_SIZE / 2, BULLET_SIZE, BULLET_SIZE)
      })

      state.enemies.forEach((enemy) => {
        ctx.fillStyle = "#ff4444"
        ctx.fillRect(enemy.x - ENEMY_SIZE / 2, enemy.y - ENEMY_SIZE / 2, ENEMY_SIZE, ENEMY_SIZE)

        ctx.strokeStyle = "#ff0000"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(enemy.x, enemy.y)
        ctx.lineTo(enemy.x + Math.cos(enemy.angle) * ENEMY_SIZE, enemy.y + Math.sin(enemy.angle) * ENEMY_SIZE)
        ctx.stroke()

        const healthBarWidth = ENEMY_SIZE
        const healthBarHeight = 3
        const healthPercent = enemy.health / enemy.maxHealth
        ctx.fillStyle = "#ff0000"
        ctx.fillRect(enemy.x - healthBarWidth / 2, enemy.y - ENEMY_SIZE / 2 - 8, healthBarWidth, healthBarHeight)
        ctx.fillStyle = "#00ff00"
        ctx.fillRect(
          enemy.x - healthBarWidth / 2,
          enemy.y - ENEMY_SIZE / 2 - 8,
          healthBarWidth * healthPercent,
          healthBarHeight,
        )
      })

      ctx.fillStyle = state.powerupActive ? "#ff44ff" : "#44ff44"
      ctx.fillRect(state.player.x - PLAYER_SIZE / 2, state.player.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)

      ctx.strokeStyle = state.powerupActive ? "#ff88ff" : "#88ff88"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(state.player.x, state.player.y)
      ctx.lineTo(
        state.player.x + Math.cos(state.player.angle) * PLAYER_SIZE * 1.5,
        state.player.y + Math.sin(state.player.angle) * PLAYER_SIZE * 1.5,
      )
      ctx.stroke()

      state.particles.forEach((particle) => {
        const alpha = particle.life / particle.maxLife
        ctx.fillStyle = particle.color
        ctx.globalAlpha = alpha
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
        ctx.globalAlpha = 1
      })

      ctx.restore()

      if (state.damageFlash > 0) {
        const flashAlpha = state.damageFlash / 30
        const gradient = ctx.createRadialGradient(
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          0,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          CANVAS_WIDTH / 2,
        )
        gradient.addColorStop(0, `rgba(255, 0, 0, 0)`)
        gradient.addColorStop(0.7, `rgba(255, 0, 0, ${flashAlpha * 0.3})`)
        gradient.addColorStop(1, `rgba(255, 0, 0, ${flashAlpha * 0.6})`)
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        state.damageFlash--
      }

      setMinimapUpdate((prev) => prev + 1)

      requestAnimationFrame(gameLoop)
    }

    requestAnimationFrame(gameLoop)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mouseup", handleMouseUp)
    }
  }, [gameStarted, gameOver])

  const startGame = () => {
    setGameOver(false)
    setGameStarted(true)

    gameStateRef.current = {
      player: {
        x: 200,
        y: WORLD_HEIGHT / 2,
        angle: 0,
        health: 100,
        maxHealth: 100,
        ammo: 35,
        kills: 0,
        speed: 3,
        currency: 100,
      },
      enemies: [],
      bullets: [],
      particles: [],
      drops: [],
      buyStations: [
        { x: 250, y: WORLD_HEIGHT / 2, type: "ammo", cost: AMMO_COST, size: BUY_STATION_SIZE },
        { x: 800, y: 300, type: "health", cost: HEALTH_COST, size: BUY_STATION_SIZE },
        { x: 1800, y: 1400, type: "ammo", cost: AMMO_COST, size: BUY_STATION_SIZE },
        { x: 2600, y: 800, type: "health", cost: HEALTH_COST, size: BUY_STATION_SIZE },
      ],
      walls: [
        { x: 0, y: 0, width: WORLD_WIDTH, height: 20 },
        { x: 0, y: WORLD_HEIGHT - 20, width: WORLD_WIDTH, height: 20 },
        { x: 0, y: 0, width: 20, height: WORLD_HEIGHT },
        { x: WORLD_WIDTH - 20, y: 0, width: 20, height: WORLD_HEIGHT },
        { x: 600, y: 20, width: 20, height: 500 },
        { x: 600, y: 700, width: 20, height: 1280 },
        { x: 620, y: 600, width: 580, height: 20 },
        { x: 1400, y: 600, width: 380, height: 20 },
        { x: 1780, y: 20, width: 20, height: 580 },
        { x: 1780, y: 900, width: 20, height: 1080 },
        { x: 620, y: 1200, width: 580, height: 20 },
        { x: 1400, y: 1200, width: 380, height: 20 },
        { x: 300, y: 400, width: 200, height: 20 },
        { x: 900, y: 300, width: 20, height: 200 },
        { x: 1000, y: 1400, width: 200, height: 20 },
        { x: 200, y: 800, width: 300, height: 20 },
        { x: 2200, y: 1200, width: 300, height: 20 },
        { x: 2400, y: 400, width: 20, height: 300 },
      ],
      doors: [
        { x: 600, y: 540, width: 20, height: 140, cost: 100, isOpen: false, id: 0 },
        { x: 1220, y: 600, width: 160, height: 20, cost: 150, isOpen: false, id: 1 },
        { x: 1780, y: 620, width: 20, height: 260, cost: 200, isOpen: false, id: 2 },
        { x: 1220, y: 1200, width: 160, height: 20, cost: 150, isOpen: false, id: 3 },
      ],
      keys: {},
      mouseX: 0,
      mouseY: 0,
      mouseDown: false,
      lastShot: 0,
      lastEnemySpawn: 0,
      nextEnemyId: 0,
      nextBulletId: 0,
      nextParticleId: 0,
      nextDropId: 0,
      powerupActive: false,
      powerupEndTime: 0,
      gamepadIndex: gameStateRef.current.gamepadIndex,
      damageFlash: 0,
      screenShake: 0,
      lastHealth: 100,
      cameraX: 0,
      cameraY: 0,
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      {!gameStarted ? (
        <div className="text-center">
          <h1 className="mb-8 font-mono text-6xl font-bold text-primary">TOP-DOWN SHOOTER</h1>
          <div className="mb-8 space-y-2 text-muted-foreground">
            <p className="font-mono">WASD - Move</p>
            <p className="font-mono">Mouse - Aim</p>
            <p className="font-mono">Click - Shoot</p>
            <p className="font-mono">E - Buy at Station / Open Door</p>
            <p className="font-mono text-sm opacity-70">
              Controller: Left Stick - Move, Right Stick - Aim, RT - Shoot, A - Interact
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={startGame}
              className="bg-primary px-8 py-4 font-mono text-xl font-bold text-primary-foreground transition-all hover:bg-primary/80"
            >
              START GAME
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="border-2 border-primary bg-transparent px-8 py-4 font-mono text-xl font-bold text-primary transition-all hover:bg-primary/10"
            >
              SETTINGS
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-2 border-primary" />
            <GameHUD player={gameStateRef.current.player} />
            <MiniMap
              player={gameStateRef.current.player}
              enemies={gameStateRef.current.enemies}
              buyStations={gameStateRef.current.buyStations}
              walls={gameStateRef.current.walls}
              doors={gameStateRef.current.doors}
              canvasWidth={WORLD_WIDTH}
              canvasHeight={WORLD_HEIGHT}
              updateTrigger={minimapUpdate}
            />

            {doorPrompt && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded border-2 border-primary bg-card/90 px-6 py-3 font-mono backdrop-blur-sm">
                <p className="text-center text-lg font-bold text-foreground">
                  Press E{controllerConnected ? " or A" : ""} to open DOOR (${doorPrompt.cost})
                </p>
              </div>
            )}

            {buyPrompt && !doorPrompt && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded border-2 border-primary bg-card/90 px-6 py-3 font-mono backdrop-blur-sm">
                <p className="text-center text-lg font-bold text-foreground">
                  Press E{controllerConnected ? " or A" : ""} to buy {buyPrompt.type.toUpperCase()} (${buyPrompt.cost})
                </p>
              </div>
            )}
          </div>

          {gameOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
              <div className="text-center">
                <h2 className="mb-4 font-mono text-6xl font-bold text-destructive">GAME OVER</h2>
                <p className="mb-8 font-mono text-2xl text-foreground">Kills: {gameStateRef.current.player.kills}</p>
                <button
                  onClick={startGame}
                  className="bg-primary px-8 py-4 font-mono text-xl font-bold text-primary-foreground transition-all hover:bg-primary/80"
                >
                  RESTART
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95">
          <div className="w-full max-w-md rounded-lg border-2 border-primary bg-card p-8">
            <h2 className="mb-6 font-mono text-3xl font-bold text-primary">SETTINGS</h2>
            <div className="mb-8 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-foreground">Sound Volume</span>
                <span className="font-mono text-muted-foreground">100%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-foreground">Music Volume</span>
                <span className="font-mono text-muted-foreground">80%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-foreground">Controller Sensitivity</span>
                <span className="font-mono text-muted-foreground">Medium</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-foreground">Controller Status</span>
                <span className={`font-mono ${controllerConnected ? "text-green-500" : "text-red-500"}`}>
                  {controllerConnected ? "🎮 Connected" : "❌ Not Connected"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full bg-primary px-6 py-3 font-mono text-lg font-bold text-primary-foreground transition-all hover:bg-primary/80"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
