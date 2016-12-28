/*
 *  "Wave" by Jerome Herr
 *   http://www.openprocessing.org/sketch/152169
 *   Licensed under Creative Commons Attribution ShareAlike
 *   https://creativecommons.org/licenses/by-sa/3.0
 *   https://creativecommons.org/licenses/GPL/2.0/
 */

int num = 16;
float step, sz, offSet, theta, angle;

void setup() {
  size(600, 400);
  strokeWeight(5);
  step = 22;
}

void draw() {
  background(20);
  translate(width/2, height*.75);
  angle=0;
  for (int i=0; i<num; i++) {
    stroke(255);
    noFill();
    sz = i*step;
    float offSet = TWO_PI/num*i;
    float arcEnd = map(sin(theta+offSet),-1,1, PI, TWO_PI);
    arc(0, 0, sz, sz, PI, arcEnd);
  }
  colorMode(RGB);
  resetMatrix();
  theta += .0523;
  
}
