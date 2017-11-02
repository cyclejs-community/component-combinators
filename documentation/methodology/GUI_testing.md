# GUI testing
## Defining the problem
To generate a set of test cases, test designers attempt to cover all the functionality of 
the system and fully exercise the GUI itself. The difficulty in accomplishing this task is 
three-fold: 

- to deal with domain size and with sequences. 
- In addition, the tester faces more difficulty when they have to do regression testing.
- in addition to testing behaviour, the tester must also test for visual appearance 

### Size of the domain and sequences
Unlike a CLI (command line interface) system, a GUI has many operations that need to be tested. A relatively small program such as Microsoft WordPad has 325 possible GUI operations[^1] In a large program, the number of operations can easily be an order of magnitude larger.

The second problem is the sequencing problem. Some functionality of the system may only be accomplished with a sequence of GUI events. For example, to open a file a user may have to first click on the `File` menu, then select the `Open` operation, use a dialog box to specify the file name, and focus the application on the newly opened window. Increasing the number of possible operations increases the sequencing problem exponentially. This can become a serious issue when the tester is creating test cases manually.

### Regression testing
Regression testing becomes a problem with GUIs as well. A GUI may change significantly, even though the underlying application does not. A test designed to follow a certain path through the GUI may then fail since a button, menu item, or dialog may have changed location or appearance.

This is a very serious problem as a GUI is often built iteratively, and as such changes with a much higher frequency that the core application, laeding to constantly having to revisit existing tests.

### Behavior vs. appearance
GUI specifications fall in several categories :

- behaviour
   - navigation
   - actions and their visual trigger (button, form etc.)
   - visual feedback to user actions (error messages, etc.)
- look
   - style, layout, alignment, content, colour, size, scrollbar, readability, etc.

Problems related to testing the behavioural part of the GUI have been described in the previous sections (domain size and sequences). The specific challenges linked to visual testing are :

- regression testing, as described previously. Any changes, even small, in the visual appearance can lead to the invalidation of many tests down the road
- visual appearance itself may respond to a complex logic (responsive design, media-query, etc.) which have to be simulated, extending by then considerably the test domain

## Test methods
The key methods used for GUI testing are :

- **Manual testing**. Under this approach, graphical screens are checked manually by testers in conformance with the requirements stated in the business requirements document.
- **Automated record and replay**. Mainly done by automation tools. This is done in two parts. During `Record`, test steps are captured by the automation tool. During `playback`, the recorded test steps are executed on the application under test.
- **Automated inputs**. Similar to the previous testing method, this method allows to simulate programmatically user inputs, and observe the output of the application under test.
- **Model-based testing**.
Under this method, the expected behaviour of the GUI is predicted by a formal model incorporating a representation of GUI inputs and state. The actual GUI behaviour is checked to be consistent with
 the expected behaviour. 
- **Visual testing** (a.k.a. visual checking or visual regression testing). The term Visual Testing (VT) is used to refer to that part of GUI testing concerned with testing the visual properties of GUI elements and Visual Defect (VD) is the term that will be used to refer for those defects reported by this type of testing[^2].

### Model-based testing
Model-based testing allows to :
 
- use algorithms to figure out all of the usage paths for an application to pare down the number to get a maximum in coverage and a minimum of tests, and ...
- automate generation of such test cases 

The cost associated to this approach is linked precisely to the construction of the behaviour model. Such endeavour requires complete documentation for applications (and updating and fully maintaining that documentation throughout the entire development process). 

A common approach is to modelize GUI behaviour via extended finite state machines. The use of state machines for specifying user interfaces has been explored as early as mid-1980s in [^3]. At that time, however, state machines were applied to textual user interfaces, which are much simpler to model and analyze (for example, they do not involve callbacks). With the advent of flexible, dynamically  modifiable GUI systems research in the human-computer interface (HCI) area  has focused primarily on dynamic aspects of GUI-based systems, where state  machines appear to be less useful. However, in the domain of static GUI with a low number of states, EFSMs are quite appropriate and yield high-level and accurate models of user expectations of the system[^4].

 
# References
[^1]:  Wikipedia, https://en.wikipedia.org/wiki/Graphical_user_interface_testing

[^2]: Ayman Issa, Jonathan Sillito, Vahid Garousi. Visual Testing of Graphical User Interfaces: an Exploratory Study Towards Systematic Definitions and Approaches. WSE '12 Proceedings of the 2012 IEEE 14th International Symposium on Web Systems Evolution (WSE). Pages 11-15. http://people.ucalgary.ca/~sillito/work/wse2012.pdf

[^3]: A.I. Wasserman. Extending state transition diagrams for the specification of human-computer interaction. IEEE Transactions on Software Engineering,11(8):699–713, August 1985.

[^4]: Vivien Chinnapongse, Insup Lee, Oleg Sokolsky, Shaohui Wang, and Paul L. Jones, "Model-Based Testing of GUI-Driven Applications", Lecture Notes in Computer Science: Software Technologies for Embedded and Ubiquitous Systems 5860, 203-214. November 2009. http://repository.upenn.edu/cis_papers/423/

[^5]: Emil Alégroth, Michel Nass. Visual GUI Testing: The technique, Problems and the Future. http://sast.se/q-moten/2014/Q1_2014_VGT.pdf

[^6]: Imran Ali Qureshi, Aamer Nadeem. GUI Testing Techniques: A Survey. International Journal of Future Computer and Communication, Vol. 2, No. 2, April 2013. http://www.ijfcc.org/papers/139-B077.pdf

