// the size of screen 200 x 200 pixels
size(200,200);

// draw rectangles from the center
rectMode(CENTER);

// rectangle is the body
rect(100,100,20,100);

// legs
line(90,150,80,160);
line(110,150,120,160);

// head
ellipse(100,70,60,60);

// eyes
ellipse(81,70,16,32); 
ellipse(119,70,16,32);

// print to the console
print("hello, mars!");