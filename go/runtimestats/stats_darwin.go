// +build darwin

package runtimestats

/*
#import <mach/mach.h>
#import <mach/task.h>
#import <assert.h>

float tot_cpu = 0;
int64_t tot_resident = 0;
int64_t tot_virtual = 0;
int64_t tot_free = 0;

void GetTaskStats() {
    // get cpu usage
    thread_array_t thread_list;
    mach_msg_type_number_t thread_count;
    thread_info_data_t thinfo;
    mach_msg_type_number_t thread_info_count;
    thread_basic_info_t basic_info_th;
    if (task_threads(mach_task_self(), &thread_list, &thread_count) != KERN_SUCCESS) {
        return;
    }
    tot_cpu = 0;
    for (int j = 0; j < thread_count; j++) {
        thread_info_count = THREAD_INFO_MAX;
        if (thread_info(thread_list[j], THREAD_BASIC_INFO, (thread_info_t)thinfo,
            &thread_info_count) != KERN_SUCCESS) {
            return;
        }
        basic_info_th = (thread_basic_info_t)thinfo;
        if (!(basic_info_th->flags & TH_FLAGS_IDLE)) {
            tot_cpu += basic_info_th->cpu_usage / (float)TH_USAGE_SCALE * 100.0;
        }
    }
    vm_deallocate(mach_task_self(), (vm_offset_t)thread_list, thread_count * sizeof(thread_t));

    // get real memory used
    task_vm_info_data_t task_info_data;
    mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
    if (task_info(mach_task_self(), TASK_VM_INFO, (task_info_t)&task_info_data, &count) != KERN_SUCCESS) {
        return;
    }
    tot_resident = task_info_data.resident_size - task_info_data.reusable;
    tot_virtual = task_info_data.virtual_size;

    // get system free memory
    mach_port_t host_port;
    mach_msg_type_number_t host_size;
    vm_size_t pagesize;
    host_port = mach_host_self();
    host_size = sizeof(vm_statistics_data_t) / sizeof(integer_t);
    host_page_size(host_port, &pagesize);
    vm_statistics_data_t vm_stat;
    if (host_statistics(host_port, HOST_VM_INFO, (host_info_t)&vm_stat, &host_size) != KERN_SUCCESS) {
        return;
    }
    tot_free = vm_stat.free_count * pagesize;
}

int64_t TotalResident() {
    return tot_resident;
}

int TotalCPU() {
    return (int)(tot_cpu * 100);
}

int64_t TotalVirtual() {
    return tot_virtual;
}

int64_t TotalFree() {
    return tot_free;
}
*/
import "C"

func getStats() (res statsResult) {
	C.GetTaskStats()
	res.TotalCPU = int(C.TotalCPU())
	res.TotalResident = int64(C.TotalResident())
	res.TotalVirtual = int64(C.TotalVirtual())
	res.TotalFree = int64(C.TotalFree())
	return res
}
