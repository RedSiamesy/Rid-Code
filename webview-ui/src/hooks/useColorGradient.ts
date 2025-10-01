import { useState, useEffect, useCallback } from "react"

export function useColorGradient(
  baseColor: string,
  isActive: boolean,
  intervalMs: number = 100,
  saturationRange: [number, number] = [40, 80],
  lightnessRange: [number, number] = [45, 65]
) {
  const [currentColor, setCurrentColor] = useState(baseColor)

  // 将十六进制颜色转换为HSL
  const hexToHsl = useCallback((hex: string): [number, number, number] => {
    // 去除#号
    hex = hex.replace("#", "")
    
    // 解析RGB值
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255
    
    // 找到RGB中的最大值和最小值
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    
    // 计算亮度
    let l = (max + min) / 2
    
    let h = 0
    let s = 0
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6
          break
        case g:
          h = ((b - r) / d + 2) / 6
          break
        case b:
          h = ((r - g) / d + 4) / 6
          break
      }
    }
    
    return [h * 360, s * 100, l * 100]
  }, [])

  // 将HSL转换为十六进制颜色
  const hslToHex = useCallback((h: number, s: number, l: number): string => {
    s /= 100
    l /= 100
    
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - c / 2
    
    let r = 0
    let g = 0
    let b = 0
    
    if (h >= 0 && h < 60) {
      r = c
      g = x
    } else if (h >= 60 && h < 120) {
      r = x
      g = c
    } else if (h >= 120 && h < 180) {
      g = c
      b = x
    } else if (h >= 180 && h < 240) {
      g = x
      b = c
    } else if (h >= 240 && h < 300) {
      r = x
      b = c
    } else if (h >= 300 && h < 360) {
      r = c
      b = x
    }
    
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    if (!isActive) {
      setCurrentColor(baseColor)
      return
    }

    // 获取基础颜色的色相
    const [baseHue] = hexToHsl(baseColor)
    
    let hue = baseHue
    let saturationDirection = 1
    let lightnessDirection = 1
    let currentSaturation = saturationRange[0]
    let currentLightness = lightnessRange[0]

    const interval = setInterval(() => {
      // 在基础色相附近变化色相
      hue = (baseHue + Math.sin(Date.now() / 192) * 30) % 360
      
      // 饱和度在范围内来回变化
      currentSaturation += saturationDirection
      if (currentSaturation >= saturationRange[1] || currentSaturation <= saturationRange[0]) {
        saturationDirection *= -1
      }
      
      // 亮度在范围内来回变化
      currentLightness += lightnessDirection
      if (currentLightness >= lightnessRange[1] || currentLightness <= lightnessRange[0]) {
        lightnessDirection *= -1
      }
      
      // 生成新颜色
      const newColor = hslToHex(hue, currentSaturation, currentLightness)
      setCurrentColor(newColor)
    }, intervalMs)

    return () => clearInterval(interval)
  }, [isActive, baseColor, hexToHsl, hslToHex, intervalMs, saturationRange, lightnessRange])

  return currentColor
}
