"use client"

import { useEffect, useRef } from "react"

interface Player {
  x: number
  y: number
}

interface Enemy {
  x: number
  y: number
}

interface BuyStation {
  x: number
  y: number
  type: "ammo" | "health"
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
  isOpen: boolean
}

interface MiniMapProps {
  player: Player
  enemies: Enemy[]
  buyStations: BuyStation[]
  walls?: Wall[]
  doors?: Door[]
  canvasWidth: number
  canvasHeight: number
  updateTrigger?: number
}

export function MiniMap({
  player,
  enemies,
  buyStations,
  walls,
  doors,
  canvasWidth,
  canvasHeight,
  updateTrigger,
}: MiniMapProps) {
  const mapSize = 150
  const scale = mapSize / Math.max(canvasWidth, canvasHeight)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#1a1a1a"
    ctx.fillRect(0, 0, mapSize, mapSize)

    // Draw grid
    ctx.strokeStyle = "#333333"
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const pos = (i * mapSize) / 5
      ctx.beginPath()
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, mapSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, pos)
      ctx.lineTo(mapSize, pos)
      ctx.stroke()
    }

    if (walls) {
      ctx.fillStyle = "#555555"
      walls.forEach((wall) => {
        const x = wall.x * scale
        const y = wall.y * scale
        const width = wall.width * scale
        const height = wall.height * scale
        ctx.fillRect(x, y, width, height)
      })
    }

    if (doors) {
      doors.forEach((door) => {
        const x = door.x * scale
        const y = door.y * scale
        const width = door.width * scale
        const height = door.height * scale

        if (door.isOpen) {
          // Open door - green outline
          ctx.strokeStyle = "#00ff88"
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, width, height)
        } else {
          // Closed door - orange fill
          ctx.fillStyle = "#ff8800"
          ctx.fillRect(x, y, width, height)
        }
      })
    }

    // Draw buy stations
    buyStations.forEach((station) => {
      ctx.fillStyle = station.type === "ammo" ? "#ffaa00" : "#00ff88"
      const x = station.x * scale
      const y = station.y * scale
      ctx.fillRect(x - 4, y - 4, 8, 8)
    })

    // Draw enemies
    ctx.fillStyle = "#ff4444"
    enemies.forEach((enemy) => {
      const x = enemy.x * scale
      const y = enemy.y * scale
      ctx.fillRect(x - 2, y - 2, 4, 4)
    })

    // Draw player
    ctx.fillStyle = "#44ff44"
    const px = player.x * scale
    const py = player.y * scale
    ctx.fillRect(px - 3, py - 3, 6, 6)
  }, [player, enemies, buyStations, walls, doors, canvasWidth, canvasHeight, scale, updateTrigger])

  return (
    <div className="absolute left-4 top-4 rounded border-2 border-primary bg-card/80 p-2 backdrop-blur-sm">
      <canvas ref={canvasRef} width={mapSize} height={mapSize} className="block" />
    </div>
  )
}
