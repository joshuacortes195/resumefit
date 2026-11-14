import { describe, expect, it } from "vitest";
import { HARD_SKILLS } from "@resumefit/skills-data";
import { countSkills } from "@resumefit/scoring";

const found = (text: string) => [...countSkills(text, HARD_SKILLS).keys()].sort();

describe("embedded and hardware skills", () => {
  it("reads the tools an embedded posting names", () => {
    const jd = "Write firmware in C and C++ for flight computers running an RTOS (FreeRTOS or Zephyr). Bring up SPI, I2C and UART peripherals on STM32 microcontrollers, debug with JTAG and an oscilloscope, and talk to the vehicle over CAN bus. Python and Git for test tooling.";
    expect(found(jd)).toEqual(expect.arrayContaining(["C", "C++", "Firmware", "RTOS", "FreeRTOS", "Zephyr", "SPI", "I2C", "UART", "STM32", "Microcontrollers", "JTAG", "Oscilloscope", "CAN bus", "Python", "Git"]));
  });

  it("tells the language C from a letter that only looks like it", () => {
    expect(found("Experience in C, C++ or Rust.")).toContain("C");
    expect(found("Strong C programming and embedded C.")).toContain("C");
    for (const text of ["We just closed our Series C round.", "Report to the C-suite weekly.", "A Class C license is required.", "Proficient in C++ and C#.", "Vitamin C research."]) expect(found(text), text).not.toContain("C");
  });

  it("does not take everyday words for hardware terms", () => {
    const plain = "You can make a difference with a strong arm of the business, assembly of teams, and a PLC registered in the UK.";
    for (const name of ["CAN bus", "Makefile", "ARM Cortex", "Assembly language", "PLC programming"]) expect(found(plain), name).not.toContain(name);
  });

  it("reads robotics and controls work", () => {
    expect(found("Built a quadcopter flight controller with a 1 kHz PID control loop, sensor fusion from an IMU and GPS through a Kalman filter, simulated in Simulink and ROS 2.")).toEqual(expect.arrayContaining(["PID control", "Sensor fusion", "IMU", "GPS", "Kalman filter", "Simulink", "ROS"]));
  });
});
